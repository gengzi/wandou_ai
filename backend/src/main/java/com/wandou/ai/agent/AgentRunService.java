package com.wandou.ai.agent;

import cn.dev33.satoken.stp.StpUtil;
import com.wandou.ai.agent.dto.AgentRunControlRequest;
import com.wandou.ai.agent.dto.AgentRunControlResponse;
import com.wandou.ai.agent.dto.AgentRunDetailResponse;
import com.wandou.ai.agent.dto.AgentRunRequest;
import com.wandou.ai.agent.dto.AgentRunResponse;
import com.wandou.ai.agent.monitor.AgentRunMonitor;
import com.wandou.ai.agent.runtime.VideoAgentOutput;
import com.wandou.ai.agent.runtime.VideoAgentRuntime;
import com.wandou.ai.agent.runtime.VideoAgentStep;
import com.wandou.ai.agent.video.VideoGenerationProvider;
import com.wandou.ai.agent.video.VideoGenerationRequest;
import com.wandou.ai.agent.video.VideoGenerationStatus;
import com.wandou.ai.asset.AssetService;
import com.wandou.ai.asset.dto.AssetResponse;
import com.wandou.ai.canvas.dto.CanvasEdgeResponse;
import com.wandou.ai.canvas.CanvasService;
import com.wandou.ai.canvas.dto.CanvasNodeResponse;
import com.wandou.ai.canvas.dto.PositionResponse;
import com.wandou.ai.common.IdGenerator;
import com.wandou.ai.conversation.ConversationService;
import com.wandou.ai.conversation.dto.ConversationResponse;
import com.wandou.ai.generation.ImageGenerationService;
import com.wandou.ai.project.ProjectService;
import com.wandou.ai.project.dto.ProjectResponse;
import com.wandou.ai.sse.SseEvent;
import com.wandou.ai.sse.SseHub;
import com.wandou.ai.task.TaskService;
import com.wandou.ai.task.dto.TaskResponse;
import io.agentscope.core.agent.AgentBase;
import io.agentscope.core.message.GenerateReason;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Service
public class AgentRunService {
    private static final Logger log = LoggerFactory.getLogger(AgentRunService.class);

    private final SseHub sseHub;
    private final ProjectService projectService;
    private final CanvasService canvasService;
    private final ConversationService conversationService;
    private final TaskService taskService;
    private final AssetService assetService;
    private final VideoAgentRuntime videoAgentRuntime;
    private final VideoGenerationProvider videoGenerationProvider;
    private final ImageGenerationService imageGenerationService;
    private final AgentRunMonitor agentRunMonitor;
    private final Map<String, MutableAgentRun> runs = new ConcurrentHashMap<>();
    private final ExecutorService executorService = Executors.newFixedThreadPool(4);
    private final ExecutorService mediaExecutorService = Executors.newFixedThreadPool(2);

    public AgentRunService(
            SseHub sseHub,
            ProjectService projectService,
            CanvasService canvasService,
            ConversationService conversationService,
            TaskService taskService,
            AssetService assetService,
            VideoAgentRuntime videoAgentRuntime,
            VideoGenerationProvider videoGenerationProvider,
            ImageGenerationService imageGenerationService,
            AgentRunMonitor agentRunMonitor
    ) {
        this.sseHub = sseHub;
        this.projectService = projectService;
        this.canvasService = canvasService;
        this.conversationService = conversationService;
        this.taskService = taskService;
        this.assetService = assetService;
        this.videoAgentRuntime = videoAgentRuntime;
        this.videoGenerationProvider = videoGenerationProvider;
        this.imageGenerationService = imageGenerationService;
        this.agentRunMonitor = agentRunMonitor;
    }

    public AgentRunResponse start(AgentRunRequest request) {
        ProjectResponse project = resolveProject(request.projectId());
        ConversationResponse conversation = conversationService.getOrCreate(request.conversationId(), project.id());
        String canvasId = valueOrDefault(request.canvasId(), project.canvasId());
        String runId = IdGenerator.longId("run_");
        String userId = StpUtil.getLoginIdAsString();
        MutableAgentRun run = new MutableAgentRun(
                runId,
                userId,
                project.id(),
                conversation.id(),
                canvasId,
                "queued",
                safeAgentName(request.agentName()),
                request.message(),
                null,
                Instant.now(),
                Instant.now()
        );
        runs.put(runId, run);
        agentRunMonitor.startRun(runId, run.createdAt, run.status);
        conversationService.addMessage(conversation.id(), project.id(), "user", "用户", request.message());
        executorService.submit(() -> execute(run, request));
        return new AgentRunResponse(runId, conversation.id(), canvasId, "running", "/api/agent/runs/" + runId + "/events");
    }

    public Optional<AgentRunDetailResponse> get(String runId) {
        MutableAgentRun run = runs.get(runId);
        return run == null ? Optional.empty() : Optional.of(run.toDetail(sseHub.replay(runId)));
    }

    public AgentRunControlResponse confirm(String runId, AgentRunControlRequest request) {
        MutableAgentRun run = requireRun(runId);
        synchronized (run.monitor) {
            if (!"waiting_confirmation".equals(run.status)) {
                return new AgentRunControlResponse(runId, run.status, "当前运行不在等待确认状态");
            }
            run.confirmationComment = commentOf(request);
            run.checkpoint = null;
            agentRunMonitor.confirmationResolved(runId);
            mark(run, "running", null);
            run.monitor.notifyAll();
        }
        publish(runId, "agent.confirmation.accepted", Map.of(
                "runId", runId,
                "comment", commentOf(request)
        ));
        return new AgentRunControlResponse(runId, "running", "已确认，继续执行");
    }

    public AgentRunControlResponse interrupt(String runId, AgentRunControlRequest request) {
        MutableAgentRun run = requireRun(runId);
        synchronized (run.monitor) {
            run.interrupted = true;
            run.interruptComment = commentOf(request);
            agentRunMonitor.interrupted(runId);
            for (AgentBase agent : run.activeAgents) {
                agent.interrupt(userInterruptMessage(run.interruptComment));
            }
            mark(run, "interrupted", null);
            run.monitor.notifyAll();
        }
        publish(runId, "run.interrupted", Map.of(
                "runId", runId,
                "comment", commentOf(request)
        ));
        return new AgentRunControlResponse(runId, "interrupted", "已打断，等待恢复或取消");
    }

    public AgentRunControlResponse resume(String runId, AgentRunControlRequest request) {
        MutableAgentRun run = requireRun(runId);
        synchronized (run.monitor) {
            run.interrupted = false;
            run.interruptComment = null;
            run.resumeComment = commentOf(request);
            agentRunMonitor.resumed(runId);
            mark(run, run.checkpoint == null ? "running" : "waiting_confirmation", null);
            run.monitor.notifyAll();
        }
        publish(runId, "run.resumed", Map.of(
                "runId", runId,
                "comment", commentOf(request)
        ));
        return new AgentRunControlResponse(runId, run.status, "已恢复");
    }

    public AgentRunControlResponse cancel(String runId, AgentRunControlRequest request) {
        MutableAgentRun run = requireRun(runId);
        synchronized (run.monitor) {
            run.cancelled = true;
            run.cancelComment = commentOf(request);
            agentRunMonitor.cancelled(runId);
            for (AgentBase agent : run.activeAgents) {
                agent.interrupt(userInterruptMessage(run.cancelComment));
            }
            run.checkpoint = null;
            mark(run, "cancelled", null);
            run.monitor.notifyAll();
        }
        publish(runId, "run.cancelled", Map.of(
                "runId", runId,
                "comment", commentOf(request)
        ));
        return new AgentRunControlResponse(runId, "cancelled", "已取消");
    }

    private void execute(MutableAgentRun run, AgentRunRequest request) {
        String runId = run.runId;
        mark(run, "running", null);
        publish(runId, "run.started", Map.of(
                "runId", runId,
                "projectId", run.projectId,
                "conversationId", run.conversationId,
                "canvasId", run.canvasId
        ));

        publish(runId, "message.delta", Map.of(
                "role", "assistant",
                "sender", run.agentName,
                "content", "我会用 AgentScope 多 Agent 流程拆解创作需求，并在关键节点等你确认。"
        ));

        try {
            if ("regenerate-node".equals(request.mode()) && request.nodeId() != null && !request.nodeId().isBlank()) {
                executeNodeRegeneration(run, request);
                return;
            }

            VideoAgentRuntime.VideoAgentRunListener listener = listenerFor(run);
            VideoAgentRuntime.VideoAgentOutputs planOutputs = videoAgentRuntime.plan(run.userId, request.message(), listener);
            VideoAgentOutput scriptOutput = planOutputs.require(VideoAgentStep.SCRIPT);

            conversationService.addMessage(run.conversationId, run.projectId, "assistant", run.agentName, scriptOutput.text());
            publish(runId, "message.completed", Map.of(
                    "role", "assistant",
                    "sender", run.agentName,
                    "content", scriptOutput.text()
            ));

            CanvasNodeResponse scriptNode = updateNode(run, "script-1", "running", Map.of(
                    "prompt", request.message(),
                    "agentName", run.agentName,
                    "step", "script"
            ));
            CanvasNodeResponse updatedScriptNode = canvasService.updateNode(run.canvasId, scriptNode.id(), "success", scriptOutput.output());
            publishNodeUpdated(run, updatedScriptNode);
            waitForConfirmation(run, "script", "剧本草稿已生成，请确认后继续角色、分镜和关键帧设计。");

            VideoAgentRuntime.VideoAgentOutputs designOutputs = videoAgentRuntime.design(run.userId, request.message(), listener);
            VideoAgentOutput characterOutput = designOutputs.require(VideoAgentStep.CHARACTER);
            VideoAgentOutput storyboardOutput = designOutputs.require(VideoAgentStep.STORYBOARD);
            VideoAgentOutput visualOutput = designOutputs.require(VideoAgentStep.VISUAL);
            VideoAgentOutput audioOutput = designOutputs.require(VideoAgentStep.AUDIO);

            CanvasNodeResponse characterNode = addNode(run,
                    run.canvasId,
                    "character",
                    "角色一致性生成",
                    "running",
                    new PositionResponse(500, 80),
                    Map.of("sourceNodeId", scriptNode.id(), "step", "character")
            );
            addEdge(run, scriptNode.id(), characterNode.id());
            CanvasNodeResponse updatedCharacterNode = canvasService.updateNode(run.canvasId, characterNode.id(), "success", characterOutput.output());
            publishNodeUpdated(run, updatedCharacterNode);

            CanvasNodeResponse storyboardNode = addNode(run,
                    run.canvasId,
                    "storyboard",
                    "分镜设计",
                    "running",
                    new PositionResponse(500, 480),
                    Map.of("sourceNodeId", scriptNode.id(), "step", "storyboard")
            );
            addEdge(run, scriptNode.id(), storyboardNode.id());
            addEdge(run, characterNode.id(), storyboardNode.id());
            CanvasNodeResponse updatedStoryboardNode = canvasService.updateNode(run.canvasId, storyboardNode.id(), "success", storyboardOutput.output());
            publishNodeUpdated(run, updatedStoryboardNode);

            CanvasNodeResponse imageNode = addNode(run,
                    run.canvasId,
                    "images",
                    "场景概念图生成",
                    "running",
                    new PositionResponse(960, 80),
                    Map.of("sourceNodeId", storyboardNode.id(), "step", "keyframe")
            );
            addEdge(run, storyboardNode.id(), imageNode.id());
            CanvasNodeResponse plannedImageNode = canvasService.updateNode(run.canvasId, imageNode.id(), "running", visualOutput.output());
            publishNodeUpdated(run, plannedImageNode);
            Map<String, Object> imageOutput = new java.util.LinkedHashMap<>(visualOutput.output());
            imageOutput.putAll(generateKeyframeAssetWithTimeout(run, request, imageNode, visualOutput));
            String imageStatus = "skipped".equals(imageOutput.get("imageGenerationStatus")) ? "failed" : "success";
            CanvasNodeResponse updatedImageNode = canvasService.updateNode(run.canvasId, imageNode.id(), imageStatus, imageOutput);
            publishNodeUpdated(run, updatedImageNode);

            CanvasNodeResponse audioNode = addNode(run,
                    run.canvasId,
                    "audio",
                    "生成音效配乐",
                    "running",
                    new PositionResponse(960, 480),
                    Map.of("sourceNodeId", storyboardNode.id(), "step", "audio")
            );
            addEdge(run, storyboardNode.id(), audioNode.id());
            CanvasNodeResponse plannedAudioNode = canvasService.updateNode(run.canvasId, audioNode.id(), "running", audioOutput.output());
            publishNodeUpdated(run, plannedAudioNode);
            CanvasNodeResponse updatedAudioNode = canvasService.updateNode(run.canvasId, audioNode.id(), "success", audioOutput.output());
            publishNodeUpdated(run, updatedAudioNode);

            waitForConfirmation(run, "storyboard", "角色、分镜、关键帧和声音设计已完成，请确认后创建视频生成任务。");

            CanvasNodeResponse videoNode = addNode(run,
                    run.canvasId,
                    "video",
                    "图生视频任务",
                    "running",
                    new PositionResponse(1380, 80),
                    Map.of("sourceNodeId", imageNode.id(), "step", "video")
            );
            addEdge(run, imageNode.id(), videoNode.id());

            VideoAgentRuntime.VideoAgentOutputs exportOutputs = videoAgentRuntime.reviewAndExport(run.userId, request.message(), listener);
            VideoAgentOutput exportOutput = exportOutputs.require(VideoAgentStep.EXPORT);

            TaskResponse task = taskService.create(runId, run.projectId, run.canvasId, videoNode.id(), "video");
            publish(runId, "task.created", Map.of("task", task));

            VideoGenerationStatus generation = executeVideoGeneration(run, request, visualOutput, exportOutput, task, videoNode);
            AssetResponse asset = assetService.createStoredVideo(
                    run.projectId,
                    run.canvasId,
                    videoNode.id(),
                    stringValue(exportOutput.output(), "assetName", "AI 生成视频预览"),
                    generation.videoBytes(),
                    generation.videoContentType(),
                    generation.thumbnailBytes(),
                    generation.thumbnailContentType()
            );
            TaskResponse completedTask = taskService.update(task.id(), "success", 100, "视频生成完成");
            publish(runId, "asset.created", Map.of("asset", asset));
            publish(runId, "task.completed", Map.of("task", completedTask));

            Map<String, Object> videoOutput = new java.util.LinkedHashMap<>();
            videoOutput.put("assetId", asset.id());
            videoOutput.put("thumbnailUrl", asset.thumbnailUrl());
            videoOutput.put("url", asset.url());
            videoOutput.put("duration", stringValue(exportOutput.output(), "duration", "8s"));
            videoOutput.put("model", stringValue(exportOutput.output(), "model", "AgentScope Structured Video Runtime"));
            videoOutput.put("summary", stringValue(exportOutput.output(), "summary", "视频生成完成"));
            videoOutput.put("providerJobId", generation.providerJobId());
            CanvasNodeResponse updatedVideoNode = canvasService.updateNode(run.canvasId, videoNode.id(), "success", videoOutput);
            publishNodeUpdated(run, updatedVideoNode);

            CanvasNodeResponse finalNode = addNode(run,
                    run.canvasId,
                    "final",
                    "成片合成",
                    "success",
                    new PositionResponse(1380, 480),
                    Map.of("sourceNodeId", videoNode.id(), "step", "compose")
            );
            Map<String, Object> finalOutput = new java.util.LinkedHashMap<>(exportOutput.output());
            finalOutput.put("assetId", asset.id());
            finalOutput.put("thumbnailUrl", asset.thumbnailUrl());
            finalOutput.put("url", asset.url());
            finalOutput.put("providerJobId", generation.providerJobId());
            CanvasNodeResponse updatedFinalNode = canvasService.updateNode(run.canvasId, finalNode.id(), "success", finalOutput);
            addEdge(run, videoNode.id(), finalNode.id());
            publishNodeUpdated(run, updatedFinalNode);

            mark(run, "success", null);
            publish(runId, "run.completed", Map.of(
                    "runId", runId,
                    "status", "success"
            ));
        } catch (AgentRunCancelledException ex) {
            mark(run, "cancelled", null);
            publish(runId, "run.cancelled", Map.of(
                    "runId", runId,
                    "status", "cancelled"
            ));
        } catch (RuntimeException ex) {
            String errorMessage = ex.getMessage() == null ? "agent run failed" : ex.getMessage();
            log.warn("Agent run {} failed", runId, ex);
            conversationService.addMessage(run.conversationId, run.projectId, "assistant", run.agentName, "视频生成失败：" + errorMessage);
            publish(runId, "message.completed", Map.of(
                    "role", "assistant",
                    "sender", run.agentName,
                    "content", "视频生成失败：" + errorMessage
            ));
            publish(runId, "run.failed", Map.of(
                    "runId", runId,
                    "status", "failed",
                    "error", errorMessage
            ));
            mark(run, "failed", errorMessage);
            publishMonitor(run);
        }
    }

    private VideoGenerationStatus executeVideoGeneration(
            MutableAgentRun run,
            AgentRunRequest request,
            VideoAgentOutput visualOutput,
            VideoAgentOutput exportOutput,
            TaskResponse task,
            CanvasNodeResponse videoNode
    ) {
        String providerJobId;
        try {
            providerJobId = videoGenerationProvider.submit(new VideoGenerationRequest(
                    run.userId,
                    run.runId,
                    run.projectId,
                    run.canvasId,
                    videoNode.id(),
                    request.message(),
                    stringValue(visualOutput.output(), "prompt", request.message()),
                    stringValue(exportOutput.output(), "duration", "8s"),
                    stringValue(exportOutput.output(), "model", "mock")
            ));
        } catch (RuntimeException ex) {
            String message = ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
            failVideoTask(run, task, videoNode, message);
            throw ex;
        }

        publish(run.runId, "video.provider.submitted", Map.of(
                "providerJobId", providerJobId,
                "taskId", task.id()
        ));

        int lastProgress = -1;
        String lastMessage = "";
        for (int attempt = 0; attempt < 180; attempt++) {
            ensureCanContinue(run);
            VideoGenerationStatus status = videoGenerationProvider.getStatus(providerJobId);
            String statusMessage = status.message() == null ? "视频生成任务进行中" : status.message();
            if (status.progress() != lastProgress || !statusMessage.equals(lastMessage)) {
                TaskResponse updatedTask = taskService.update(
                        task.id(),
                        "failed".equals(status.status()) ? "failed" : "running",
                        status.progress(),
                        statusMessage
                );
                publish(run.runId, "task.progress", Map.of("task", updatedTask));
                lastProgress = status.progress();
                lastMessage = statusMessage;
            }
            if ("succeeded".equals(status.status())) {
                if (status.videoBytes() == null || status.videoBytes().length == 0) {
                    failVideoTask(run, task, videoNode, "provider returned empty video");
                }
                return status;
            }
            if ("failed".equals(status.status())) {
                failVideoTask(run, task, videoNode, status.error() == null ? statusMessage : status.error());
            }
            sleep(2000);
        }
        failVideoTask(run, task, videoNode, "video provider timed out");
        throw new IllegalStateException("video provider timed out");
    }

    private Map<String, Object> generateKeyframeAsset(
            MutableAgentRun run,
            AgentRunRequest request,
            CanvasNodeResponse imageNode,
            VideoAgentOutput visualOutput
    ) {
        Map<String, Object> output = new java.util.LinkedHashMap<>();
        String prompt = stringValue(visualOutput.output(), "prompt", request.message());
        try {
            ImageGenerationService.ImageResult keyframe = imageGenerationService.generate(run.userId, prompt);
            AssetResponse keyframeAsset = keyframe.url().isBlank()
                    ? assetService.createStoredAsset(run.projectId, run.canvasId, imageNode.id(), "image", "关键帧图", keyframe.bytes(), keyframe.contentType(), keyframe.extension())
                    : assetService.create(run.projectId, run.canvasId, imageNode.id(), "image", "关键帧图", keyframe.url(), keyframe.url());
            publish(run.runId, "asset.created", Map.of("asset", keyframeAsset));
            output.put("assetId", keyframeAsset.id());
            output.put("url", keyframeAsset.url());
            output.put("thumbnailUrl", keyframeAsset.thumbnailUrl());
            output.put("imageGenerationStatus", "success");
            output.putAll(keyframe.metadata());
        } catch (RuntimeException ex) {
            output.putIfAbsent("thumbnailUrl", stringValue(visualOutput.output(), "thumbnailUrl", ""));
            output.put("imageGenerationStatus", "skipped");
            output.put("imageGenerationError", ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage());
        }
        return output;
    }

    private Map<String, Object> generateKeyframeAssetWithTimeout(
            MutableAgentRun run,
            AgentRunRequest request,
            CanvasNodeResponse imageNode,
            VideoAgentOutput visualOutput
    ) {
        try {
            return mediaExecutorService.submit(() -> generateKeyframeAsset(run, request, imageNode, visualOutput))
                    .get(75, TimeUnit.SECONDS);
        } catch (TimeoutException ex) {
            return skippedKeyframeOutput(visualOutput, "关键帧生图任务超过 75 秒未完成，已跳过以继续后续视频流程。");
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return skippedKeyframeOutput(visualOutput, "关键帧生图任务被中断，已跳过以继续后续视频流程。");
        } catch (ExecutionException ex) {
            Throwable cause = ex.getCause() == null ? ex : ex.getCause();
            return skippedKeyframeOutput(visualOutput, cause.getMessage() == null ? cause.getClass().getSimpleName() : cause.getMessage());
        }
    }

    private Map<String, Object> skippedKeyframeOutput(VideoAgentOutput visualOutput, String message) {
        Map<String, Object> output = new java.util.LinkedHashMap<>();
        output.putIfAbsent("thumbnailUrl", stringValue(visualOutput.output(), "thumbnailUrl", ""));
        output.put("imageGenerationStatus", "skipped");
        output.put("imageGenerationError", message);
        return output;
    }

    private void failVideoTask(MutableAgentRun run, TaskResponse task, CanvasNodeResponse videoNode, String error) {
        String message = error == null || error.isBlank() ? "视频生成失败" : error;
        TaskResponse failedTask = taskService.update(task.id(), "failed", 100, message);
        publish(run.runId, "task.failed", Map.of("task", failedTask));
        CanvasNodeResponse failedNode = canvasService.updateNode(run.canvasId, videoNode.id(), "failed", Map.of(
                "summary", message,
                "error", message
        ));
        publishNodeUpdated(run, failedNode);
        throw new IllegalStateException(message);
    }

    private VideoAgentRuntime.VideoAgentRunListener listenerFor(MutableAgentRun run) {
        return new VideoAgentRuntime.VideoAgentRunListener() {
            @Override
            public void onAgentActivated(AgentBase agent) {
                synchronized (run.monitor) {
                    run.activeAgents.add(agent);
                }
            }

            @Override
            public void onAgentReleased(AgentBase agent) {
                synchronized (run.monitor) {
                    run.activeAgents.remove(agent);
                }
            }

            @Override
            public void onStepStarted(VideoAgentStep step, String agentName) {
                ensureCanContinue(run);
                agentRunMonitor.stepStarted(run.runId, step, agentName);
                publish(run.runId, "agent.step.started", Map.of(
                        "step", step.code(),
                        "title", step.title(),
                        "agentName", agentName
                ));
            }

            @Override
            public void onStepCompleted(VideoAgentStep step, String agentName, VideoAgentOutput output, GenerateReason reason) {
                agentRunMonitor.stepCompleted(run.runId, step, agentName, output, reason);
                publish(run.runId, "agent.step.completed", Map.of(
                        "step", step.code(),
                        "title", step.title(),
                        "agentName", agentName,
                        "reason", reason.name(),
                        "content", output == null ? "" : output.text(),
                        "output", output == null ? Map.of() : output.output()
                ));
            }
        };
    }

    private void waitForConfirmation(MutableAgentRun run, String checkpoint, String message) {
        synchronized (run.monitor) {
            if (run.cancelled) {
                throw new AgentRunCancelledException();
            }
            run.checkpoint = checkpoint;
            agentRunMonitor.confirmationRequired(run.runId);
            mark(run, "waiting_confirmation", null);
            publish(run.runId, "agent.confirmation.required", Map.of(
                    "runId", run.runId,
                    "checkpoint", checkpoint,
                    "message", message
            ));
            while (run.checkpoint != null && !run.cancelled) {
                waitOnRun(run);
            }
            if (run.cancelled) {
                throw new AgentRunCancelledException();
            }
            ensureCanContinue(run);
        }
    }

    private void ensureCanContinue(MutableAgentRun run) {
        synchronized (run.monitor) {
            while (run.interrupted && !run.cancelled) {
                waitOnRun(run);
            }
            if (run.cancelled) {
                throw new AgentRunCancelledException();
            }
        }
    }

    private void waitOnRun(MutableAgentRun run) {
        try {
            run.monitor.wait();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new AgentRunCancelledException();
        }
    }

    private void publishNodeUpdated(MutableAgentRun run, CanvasNodeResponse node) {
        publish(run.runId, "node.updated", Map.of(
                "node", node,
                "nodeId", node.id(),
                "status", node.status(),
                "output", node.output()
        ));
    }

    private MutableAgentRun requireRun(String runId) {
        MutableAgentRun run = runs.get(runId);
        if (run == null) {
            throw new IllegalArgumentException("agent run not found: " + runId);
        }
        return run;
    }

    private String commentOf(AgentRunControlRequest request) {
        return request == null || request.comment() == null ? "" : request.comment();
    }

    private Msg userInterruptMessage(String comment) {
        return Msg.builder()
                .name("用户")
                .role(MsgRole.USER)
                .textContent(comment == null || comment.isBlank() ? "请暂停当前生成流程。" : comment)
                .build();
    }

    private void executeNodeRegeneration(MutableAgentRun run, AgentRunRequest request) {
        String runId = run.runId;
        String nodeId = request.nodeId();
        String assistantText = "我会基于你的指令重新生成当前节点：" + request.message();
        conversationService.addMessage(run.conversationId, run.projectId, "assistant", run.agentName, assistantText);
        publish(runId, "message.completed", Map.of(
                "role", "assistant",
                "sender", run.agentName,
                "content", assistantText
        ));

        sleep(300);
        CanvasNodeResponse runningNode = canvasService.updateNode(run.canvasId, nodeId, "running", Map.of(
                "prompt", request.message(),
                "step", "regenerate",
                "regeneratingAt", Instant.now().toString()
        ));
        publishNodeUpdated(run, runningNode);

        sleep(800);
        CanvasNodeResponse completedNode = canvasService.updateNode(run.canvasId, nodeId, "success", regeneratedOutput(request.message(), nodeId));
        publishNodeUpdated(run, completedNode);

        sleep(100);
        mark(run, "success", null);
        publish(runId, "run.completed", Map.of(
                "runId", runId,
                "status", "success",
                "mode", "regenerate-node",
                "nodeId", nodeId
        ));
    }

    private Map<String, Object> regeneratedOutput(String message, String nodeId) {
        if (nodeId.startsWith("script")) {
            return Map.of(
                    "summary", "已重写剧本：" + message,
                    "style", "更聚焦叙事节奏和镜头推进",
                    "beats", java.util.List.of("重写开场", "加强角色动机", "补充视觉高潮", "形成视频任务")
            );
        }
        if (nodeId.startsWith("char")) {
            return Map.of(
                    "characters", java.util.List.of(
                            Map.of("name", "主角新版", "prompt", message + "，保持同一角色身份，强化可识别服装与面部特征"),
                            Map.of("name", "伙伴新版", "prompt", "延续主设定，强化材质、轮廓和情绪反馈")
                    ),
                    "consistency", "已把本次修改作为角色一致性约束。"
            );
        }
        if (nodeId.contains("storyboard")) {
            return Map.of(
                    "scenes", java.util.List.of(
                            Map.of("shot", "01", "duration", "2s", "content", "根据新指令重新建立画面：" + message),
                            Map.of("shot", "02", "duration", "3s", "content", "强化角色动作和情绪变化。"),
                            Map.of("shot", "03", "duration", "3s", "content", "以更明确的奇观镜头收束。")
                    ),
                    "camera", "重新规划推拉摇移节奏"
            );
        }
        if (nodeId.startsWith("audio")) {
            return Map.of(
                    "prompt", message,
                    "duration", "8s",
                    "mood", "已按新节点指令重配"
            );
        }
        return Map.of(
                "prompt", message,
                "summary", "已按当前节点指令重新生成具体结果：" + message,
                "duration", "8s"
        );
    }

    private static String stringValue(Map<String, Object> output, String key, String fallback) {
        Object value = output.get(key);
        if (value instanceof String string && !string.isBlank()) {
            return string;
        }
        return fallback;
    }

    @PreDestroy
    public void destroy() {
        executorService.shutdownNow();
        mediaExecutorService.shutdownNow();
    }

    private ProjectResponse resolveProject(String projectId) {
        if (projectId != null && !projectId.isBlank()) {
            return projectService.get(projectId)
                    .orElseThrow(() -> new IllegalArgumentException("project not found: " + projectId));
        }
        return projectService.create(new com.wandou.ai.project.dto.ProjectCreateRequest(
                "未命名项目",
                "由 Agent Run 自动创建",
                "16:9"
        ));
    }

    private void publish(String runId, String eventName, Object data) {
        MutableAgentRun run = runs.get(runId);
        agentRunMonitor.event(runId, eventName);
        sseHub.send(runId, SseEvent.of(eventName, runId, data));
        if (agentRunMonitor.shouldPublish(runId, eventName)) {
            publishMonitor(run);
        }
    }

    private CanvasNodeResponse addNode(
            MutableAgentRun run,
            String canvasId,
            String type,
            String title,
            String status,
            PositionResponse position,
            Map<String, Object> data
    ) {
        CanvasNodeResponse node = canvasService.addNode(canvasId, type, title, status, position, data);
        publish(run.runId, "node.created", Map.of(
                "canvasId", canvasId,
                "node", node
        ));
        return node;
    }

    private CanvasNodeResponse updateNode(MutableAgentRun run, String nodeId, String status, Map<String, Object> output) {
        CanvasNodeResponse node = canvasService.updateNode(run.canvasId, nodeId, status, output);
        publishNodeUpdated(run, node);
        return node;
    }

    private CanvasEdgeResponse addEdge(MutableAgentRun run, String source, String target) {
        CanvasEdgeResponse edge = canvasService.addEdge(run.canvasId, source, target);
        publish(run.runId, "edge.created", Map.of(
                "canvasId", run.canvasId,
                "edge", edge
        ));
        return edge;
    }

    private void mark(MutableAgentRun run, String status, String error) {
        run.status = status;
        run.error = error;
        agentRunMonitor.status(run.runId, status);
        run.updatedAt = Instant.now();
    }

    private String valueOrDefault(String value, String fallback) {
        if (value != null && !value.isBlank()) {
            return value;
        }
        return fallback;
    }

    private String safeAgentName(String agentName) {
        return agentName == null || agentName.isBlank() ? "导演" : agentName;
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void publishMonitor(MutableAgentRun run) {
        if (run == null) {
            return;
        }
        sseHub.send(run.runId, SseEvent.of("run.monitor.updated", run.runId, Map.of(
                "monitor", agentRunMonitor.snapshot(run.runId)
        )));
    }

    private final class MutableAgentRun {
        private final String runId;
        private final String userId;
        private final String projectId;
        private final String conversationId;
        private final String canvasId;
        private final String agentName;
        private final String message;
        private final Instant createdAt;
        private final Object monitor = new Object();
        private final Set<AgentBase> activeAgents = new HashSet<>();
        private String status;
        private String error;
        private String checkpoint;
        private String confirmationComment;
        private String interruptComment;
        private String resumeComment;
        private String cancelComment;
        private boolean interrupted;
        private boolean cancelled;
        private Instant updatedAt;

        private MutableAgentRun(
                String runId,
                String userId,
                String projectId,
                String conversationId,
                String canvasId,
                String status,
                String agentName,
                String message,
                String error,
                Instant createdAt,
                Instant updatedAt
        ) {
            this.runId = runId;
            this.userId = userId;
            this.projectId = projectId;
            this.conversationId = conversationId;
            this.canvasId = canvasId;
            this.status = status;
            this.agentName = agentName;
            this.message = message;
            this.error = error;
            this.createdAt = createdAt;
            this.updatedAt = updatedAt;
        }

        private AgentRunDetailResponse toDetail(java.util.List<SseEvent> events) {
            return new AgentRunDetailResponse(
                    runId,
                    projectId,
                    conversationId,
                    canvasId,
                    status,
                    agentName,
                    message,
                    error,
                    checkpoint,
                    "/api/agent/runs/" + runId + "/events",
                    agentRunMonitor.snapshot(runId),
                    events,
                    createdAt,
                    updatedAt
            );
        }
    }

    private static final class AgentRunCancelledException extends RuntimeException {
    }
}
