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
import com.wandou.ai.usage.ModelUsageContext;
import io.agentscope.core.agent.AgentBase;
import io.agentscope.core.message.GenerateReason;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
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
    private final AgentRunRepository agentRunRepository;
    private final Map<String, MutableAgentRun> runs = new ConcurrentHashMap<>();
    private final ExecutorService executorService = Executors.newFixedThreadPool(4);
    private final ExecutorService mediaExecutorService = Executors.newFixedThreadPool(4);

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
            AgentRunMonitor agentRunMonitor,
            AgentRunRepository agentRunRepository
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
        this.agentRunRepository = agentRunRepository;
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
        saveRun(run);
        conversationService.addMessage(conversation.id(), project.id(), "user", "用户", request.message());
        executorService.submit(() -> execute(run, request));
        return new AgentRunResponse(runId, conversation.id(), canvasId, "running", "/api/agent/runs/" + runId + "/events");
    }

    public Optional<AgentRunDetailResponse> get(String runId) {
        MutableAgentRun run = runs.get(runId);
        if (run != null) {
            return Optional.of(run.toDetail(sseHub.replay(runId)));
        }
        return agentRunRepository.findById(runId).map(this::toDetail);
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
            if (isNodeMediaAction(request.mode()) && request.nodeId() != null && !request.nodeId().isBlank()) {
                executeNodeMediaAction(run, request);
                return;
            }

            VideoAgentRuntime.VideoAgentRunListener listener = listenerFor(run, request);
            String configuredPrompt = withGenerationSettings(request.message(), request);
            VideoAgentRuntime.VideoAgentOutputs planOutputs = videoAgentRuntime.plan(run.userId, configuredPrompt, listener, request.textModelConfigId(), usageContext(run, null, "agent.plan"));
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
            CanvasNodeResponse updatedScriptNode = canvasService.updateNode(run.canvasId, scriptNode.id(), "success", normalizedStepOutput(scriptOutput.output(), request, "script"));
            publishNodeUpdated(run, updatedScriptNode);
            List<ReferenceAsset> referenceAssets = referenceAssets(run.projectId);
            if (!referenceAssets.isEmpty()) {
                Map<String, Object> scriptWithReferences = new java.util.LinkedHashMap<>(updatedScriptNode.output());
                scriptWithReferences.put("referenceAssets", referenceAssetOutput(referenceAssets));
                updatedScriptNode = canvasService.updateNode(run.canvasId, scriptNode.id(), "success", scriptWithReferences);
                publishNodeUpdated(run, updatedScriptNode);
            }
            waitForConfirmation(run, "script", scriptConfirmationMessage(referenceAssets));
            String approvedBrief = approvedScriptBrief(configuredPrompt, updatedScriptNode.output(), run.confirmationComment, referenceAssets);

            VideoAgentRuntime.VideoAgentOutputs designOutputs = videoAgentRuntime.design(run.userId, approvedBrief, listener, request.textModelConfigId(), usageContext(run, null, "agent.design"));
            VideoAgentOutput characterOutput = designOutputs.require(VideoAgentStep.CHARACTER);
            VideoAgentOutput storyboardOutput = designOutputs.require(VideoAgentStep.STORYBOARD);
            VideoAgentOutput visualOutput = designOutputs.require(VideoAgentStep.VISUAL);
            VideoAgentOutput audioOutput = designOutputs.require(VideoAgentStep.AUDIO);

            CanvasNodeResponse characterNode = addNode(run,
                    run.canvasId,
                    "character",
                    "角色一致性生成",
                    "running",
                    new PositionResponse(680, 340),
                    Map.of("sourceNodeId", scriptNode.id(), "step", "character")
            );
            addEdge(run, scriptNode.id(), characterNode.id());
            CanvasNodeResponse updatedCharacterNode = canvasService.updateNode(run.canvasId, characterNode.id(), "success", normalizedStepOutput(enrichCharacterOutput(characterOutput.output(), referenceAssets), request, "character"));
            publishNodeUpdated(run, updatedCharacterNode);

            CanvasNodeResponse storyboardNode = addNode(run,
                    run.canvasId,
                    "storyboard",
                    "分镜设计",
                    "running",
                    new PositionResponse(1040, 340),
                    Map.of("sourceNodeId", scriptNode.id(), "step", "storyboard")
            );
            addEdge(run, scriptNode.id(), storyboardNode.id());
            addEdge(run, characterNode.id(), storyboardNode.id());
            CanvasNodeResponse updatedStoryboardNode = canvasService.updateNode(run.canvasId, storyboardNode.id(), "success", normalizedStepOutput(storyboardOutput.output(), request, "storyboard"));
            publishNodeUpdated(run, updatedStoryboardNode);

            CanvasNodeResponse audioNode = addNode(run,
                    run.canvasId,
                    "audio",
                    "生成音效配乐",
                    "running",
                    new PositionResponse(680, 960),
                    Map.of("sourceNodeId", storyboardNode.id(), "step", "audio")
            );
            addEdge(run, storyboardNode.id(), audioNode.id());
            CanvasNodeResponse plannedAudioNode = canvasService.updateNode(run.canvasId, audioNode.id(), "running", normalizedStepOutput(audioOutput.output(), request, "audio"));
            publishNodeUpdated(run, plannedAudioNode);
            CanvasNodeResponse updatedAudioNode = canvasService.updateNode(run.canvasId, audioNode.id(), "success", normalizedStepOutput(audioOutput.output(), request, "audio"));
            publishNodeUpdated(run, updatedAudioNode);

            List<ShotPlan> shots = shotPlans(storyboardOutput, request);
            waitForConfirmation(run, "storyboard", "角色、分镜和声音设计已完成。确认后将按 " + shots.size() + " 个分镜逐镜头生成关键帧和视频片段。");

            VideoAgentRuntime.VideoAgentOutputs exportOutputs = videoAgentRuntime.reviewAndExport(run.userId, approvedBrief, listener, request.textModelConfigId(), usageContext(run, storyboardNode.id(), "agent.review-export"));
            VideoAgentOutput exportOutput = exportOutputs.require(VideoAgentStep.EXPORT);

            CanvasNodeResponse finalNode = addNode(run,
                    run.canvasId,
                    "final",
                    "成片合成",
                    "running",
                    new PositionResponse(860, 1320),
                    Map.of("sourceNodeId", storyboardNode.id(), "step", "compose", "clipCount", shots.size())
            );
            addEdge(run, audioNode.id(), finalNode.id());

            List<ClipResult> clips = new java.util.ArrayList<>();
            for (ShotPlan shot : shots) {
                ClipResult clip = renderShotClip(run, request, storyboardNode, finalNode, visualOutput, exportOutput, shot, referenceAssets);
                clips.add(clip);
            }

            Map<String, Object> finalOutput = new java.util.LinkedHashMap<>(exportOutput.output());
            List<Map<String, Object>> clipOutputs = clips.stream().map(ClipResult::output).toList();
            Optional<ClipResult> firstClipWithMedia = clips.stream()
                    .filter(clip -> hasText(clip.asset().url()) || hasText(clip.asset().thumbnailUrl()))
                    .findFirst();
            finalOutput.put("clips", clipOutputs);
            finalOutput.put("clipCount", clips.size());
            finalOutput.put("assetIds", clips.stream().map(clip -> clip.asset().id()).toList());
            finalOutput.put("thumbnailUrl", firstClipWithMedia.map(clip -> clip.asset().thumbnailUrl()).orElse(""));
            finalOutput.put("url", firstClipWithMedia.map(clip -> clip.asset().url()).orElse(""));
            finalOutput.put("videoGenerationStatus", clips.stream().anyMatch(clip -> "success".equals(clip.output().get("videoGenerationStatus"))) ? "success" : "skipped");
            finalOutput.put("compositionMode", "shot-sequence");
            finalOutput.put("summary", "已按 " + clips.size() + " 个分镜生成独立视频片段，最终节点按顺序聚合 clips，后续可接入合成器拼接成长视频。");
            finalOutput.put("referenceAssets", referenceAssetOutput(referenceAssets));
            finalOutput.put("parameters", generationSettingsOutput(request));
            CanvasNodeResponse updatedFinalNode = canvasService.updateNode(run.canvasId, finalNode.id(), "success", finalOutput);
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

    private ClipResult renderShotClip(
            MutableAgentRun run,
            AgentRunRequest request,
            CanvasNodeResponse storyboardNode,
            CanvasNodeResponse finalNode,
            VideoAgentOutput baseVisualOutput,
            VideoAgentOutput exportOutput,
            ShotPlan shot,
            List<ReferenceAsset> referenceAssets
    ) {
        VideoAgentOutput shotVisualOutput = visualOutputForShot(baseVisualOutput, shot);
        PlannedFrame firstFramePlan = planShotFrame(run, storyboardNode, shotVisualOutput, shot, "first", "首帧", 500);
        PlannedFrame lastFramePlan = planShotFrame(run, storyboardNode, shotVisualOutput, shot, "last", "尾帧", 860);
        Future<Map<String, Object>> firstFrameFuture = mediaExecutorService.submit(() -> generateKeyframeAsset(run, request, firstFramePlan.node(), firstFramePlan.visualOutput(), referenceAssets));
        Future<Map<String, Object>> lastFrameFuture = mediaExecutorService.submit(() -> generateKeyframeAsset(run, request, lastFramePlan.node(), lastFramePlan.visualOutput(), referenceAssets));
        FrameResult firstFrame = completeShotFrame(run, firstFramePlan, firstFrameFuture);
        FrameResult lastFrame = completeShotFrame(run, lastFramePlan, lastFrameFuture);

        CanvasNodeResponse videoNode = addNode(run,
                run.canvasId,
                "video",
                shot.label() + " 视频片段",
                "running",
                new PositionResponse(1220, 660 + ((shot.index() - 1) * 220)),
                Map.of("sourceNodeId", firstFrame.node().id(), "step", "shot-video", "shotIndex", shot.index())
        );
        addEdge(run, firstFrame.node().id(), videoNode.id());
        addEdge(run, lastFrame.node().id(), videoNode.id());
        addEdge(run, videoNode.id(), finalNode.id());

        TaskResponse task = taskService.create(run.runId, run.projectId, run.canvasId, videoNode.id(), "shot-video");
        publish(run.runId, "task.created", Map.of("task", task));

        Map<String, Object> videoPlan = new java.util.LinkedHashMap<>(shotVisualOutput.output());
        videoPlan.put("firstFrame", frameOutput(firstFrame));
        videoPlan.put("lastFrame", frameOutput(lastFrame));
        videoPlan.put("firstFramePrompt", stringValue(firstFrame.output(), "prompt", ""));
        videoPlan.put("lastFramePrompt", stringValue(lastFrame.output(), "prompt", ""));
        VideoAgentOutput videoVisualOutput = new VideoAgentOutput(shotVisualOutput.step(), shotVisualOutput.agentName(), shotVisualOutput.text(), videoPlan);
        VideoGenerationStatus generation = executeVideoGeneration(run, request, videoVisualOutput, exportOutput, task, videoNode, referenceAssets);
        boolean hasVideoBytes = generation.videoBytes() != null && generation.videoBytes().length > 0;
        String assetName = shot.label() + " 视频片段";
        AssetResponse asset = hasVideoBytes
                ? assetService.createStoredVideo(
                        run.projectId,
                        run.canvasId,
                        videoNode.id(),
                        assetName,
                        generation.videoBytes(),
                        generation.videoContentType(),
                        generation.thumbnailBytes(),
                        generation.thumbnailContentType()
                )
                : assetService.create(
                        run.projectId,
                        run.canvasId,
                        videoNode.id(),
                        "video",
                        assetName + "占位结果",
                        "",
                        stringValue(firstFrame.output(), "thumbnailUrl", stringValue(lastFrame.output(), "thumbnailUrl", stringValue(shotVisualOutput.output(), "thumbnailUrl", "")))
                );
        TaskResponse completedTask = taskService.update(task.id(), "success", 100, hasVideoBytes ? "视频片段生成完成" : "视频模型暂不可用，已生成可追踪占位片段");
        publish(run.runId, "asset.created", Map.of("asset", asset));
        publish(run.runId, "task.completed", Map.of("task", completedTask));

        Map<String, Object> videoOutput = new java.util.LinkedHashMap<>();
        videoOutput.put("nodeId", videoNode.id());
        videoOutput.put("taskId", task.id());
        videoOutput.put("assetId", asset.id());
        videoOutput.put("thumbnailUrl", asset.thumbnailUrl());
        videoOutput.put("url", asset.url());
        videoOutput.put("duration", shot.duration());
        videoOutput.put("model", stringValue(exportOutput.output(), "model", "AgentScope Structured Video Runtime"));
        videoOutput.put("summary", shot.content());
        videoOutput.put("prompt", stringValue(videoVisualOutput.output(), "prompt", request.message()));
        videoOutput.put("firstFrame", frameOutput(firstFrame));
        videoOutput.put("lastFrame", frameOutput(lastFrame));
        videoOutput.put("firstFrameUrl", stringValue(firstFrame.output(), "url", stringValue(firstFrame.output(), "thumbnailUrl", "")));
        videoOutput.put("lastFrameUrl", stringValue(lastFrame.output(), "url", stringValue(lastFrame.output(), "thumbnailUrl", "")));
        videoOutput.put("shotIndex", shot.index());
        videoOutput.put("shot", shot.shot());
        videoOutput.put("providerJobId", generation.providerJobId());
        videoOutput.put("videoGenerationStatus", hasVideoBytes ? "success" : "skipped");
        videoOutput.put("referenceAssets", referenceAssetOutput(referenceAssets));
        videoOutput.put("parameters", generationSettingsOutput(request));
        if (generation.error() != null && !generation.error().isBlank()) {
            videoOutput.put("videoGenerationError", generation.error());
        }
        CanvasNodeResponse updatedVideoNode = canvasService.updateNode(run.canvasId, videoNode.id(), "success", videoOutput);
        publishNodeUpdated(run, updatedVideoNode);
        return new ClipResult(updatedVideoNode, task, asset, generation, videoOutput);
    }

    private PlannedFrame planShotFrame(
            MutableAgentRun run,
            CanvasNodeResponse storyboardNode,
            VideoAgentOutput shotVisualOutput,
            ShotPlan shot,
            String frameKind,
            String frameTitle,
            int x
    ) {
        VideoAgentOutput frameVisualOutput = visualOutputForShotFrame(shotVisualOutput, shot, frameKind, frameTitle);
        CanvasNodeResponse frameNode = addNode(run,
                run.canvasId,
                "images",
                shot.label() + " " + frameTitle,
                "running",
                new PositionResponse(x, 660 + ((shot.index() - 1) * 220)),
                Map.of("sourceNodeId", storyboardNode.id(), "step", frameKind + "-frame", "shotIndex", shot.index())
        );
        addEdge(run, storyboardNode.id(), frameNode.id());
        CanvasNodeResponse plannedFrameNode = canvasService.updateNode(run.canvasId, frameNode.id(), "running", frameVisualOutput.output());
        publishNodeUpdated(run, plannedFrameNode);
        return new PlannedFrame(plannedFrameNode, frameVisualOutput);
    }

    private FrameResult completeShotFrame(MutableAgentRun run, PlannedFrame plannedFrame, Future<Map<String, Object>> frameFuture) {
        Map<String, Object> frameOutput = new java.util.LinkedHashMap<>(plannedFrame.visualOutput().output());
        try {
            frameOutput.putAll(frameFuture.get(75, TimeUnit.SECONDS));
        } catch (TimeoutException ex) {
            frameOutput.putAll(skippedKeyframeOutput(plannedFrame.visualOutput(), "关键帧生图任务超过 75 秒未完成，已跳过以继续后续视频流程。"));
            frameFuture.cancel(true);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            frameOutput.putAll(skippedKeyframeOutput(plannedFrame.visualOutput(), "关键帧生图任务被中断，已跳过以继续后续视频流程。"));
        } catch (ExecutionException ex) {
            Throwable cause = ex.getCause() == null ? ex : ex.getCause();
            frameOutput.putAll(skippedKeyframeOutput(plannedFrame.visualOutput(), cause.getMessage() == null ? cause.getClass().getSimpleName() : cause.getMessage()));
        }
        String frameStatus = "skipped".equals(frameOutput.get("imageGenerationStatus")) ? "failed" : "success";
        CanvasNodeResponse updatedFrameNode = canvasService.updateNode(run.canvasId, plannedFrame.node().id(), frameStatus, frameOutput);
        publishNodeUpdated(run, updatedFrameNode);
        return new FrameResult(updatedFrameNode, frameOutput);
    }

    private VideoAgentOutput visualOutputForShot(VideoAgentOutput baseVisualOutput, ShotPlan shot) {
        Map<String, Object> output = new java.util.LinkedHashMap<>(baseVisualOutput.output());
        String basePrompt = stringValue(baseVisualOutput.output(), "prompt", "");
        String prompt = """
                分镜 %s：%s
                时长：%s
                内容：%s
                视觉要求：%s
                """.formatted(shot.shot(), shot.label(), shot.duration(), shot.content(), basePrompt).trim();
        output.put("prompt", prompt);
        output.put("shotIndex", shot.index());
        output.put("shot", shot.shot());
        output.put("duration", shot.duration());
        output.put("content", shot.content());
        return new VideoAgentOutput(baseVisualOutput.step(), baseVisualOutput.agentName(), baseVisualOutput.text(), output);
    }

    private VideoAgentOutput visualOutputForShotFrame(VideoAgentOutput shotVisualOutput, ShotPlan shot, String frameKind, String frameTitle) {
        Map<String, Object> output = new java.util.LinkedHashMap<>(shotVisualOutput.output());
        boolean lastFrame = "last".equals(frameKind);
        String basePrompt = stringValue(shotVisualOutput.output(), "prompt", "");
        String prompt = """
                %s 的%s设计稿。
                分镜：%s
                时长：%s
                画面内容：%s
                时间点：%s
                视觉要求：保持角色、服装、色彩和场景连续性；适合作为视频模型%s输入。%s
                """.formatted(
                shot.label(),
                frameTitle,
                shot.shot(),
                shot.duration(),
                shot.content(),
                lastFrame ? "镜头结束动作与构图，保留运动后的姿态和情绪结果" : "镜头开始动作与构图，清晰建立角色和场景",
                lastFrame ? "尾帧" : "首帧",
                basePrompt.isBlank() ? "" : "\n基础视觉提示：" + basePrompt
        ).trim();
        output.put("prompt", prompt);
        output.put("frameKind", frameKind);
        output.put("frameTitle", frameTitle);
        return new VideoAgentOutput(shotVisualOutput.step(), shotVisualOutput.agentName(), shotVisualOutput.text(), output);
    }

    private List<ShotPlan> shotPlans(VideoAgentOutput storyboardOutput, AgentRunRequest request) {
        Object scenes = storyboardOutput.output().get("scenes");
        if (scenes instanceof List<?> items && !items.isEmpty()) {
            java.util.ArrayList<ShotPlan> shots = new java.util.ArrayList<>();
            int limit = Math.min(items.size(), 6);
            for (int index = 0; index < limit; index++) {
                Object item = items.get(index);
                if (item instanceof Map<?, ?> scene) {
                    String shot = mapString(scene, "shot", String.format("%02d", index + 1));
                    String duration = configuredDuration(request, mapString(scene, "duration", stringValue(storyboardOutput.output(), "duration", "4s")));
                    String content = mapString(scene, "content", mapString(scene, "prompt", mapString(scene, "description", request.message())));
                    shots.add(new ShotPlan(index + 1, shot, duration, content));
                } else if (item != null) {
                    shots.add(new ShotPlan(index + 1, String.format("%02d", index + 1), "4s", String.valueOf(item)));
                }
            }
            if (!shots.isEmpty()) {
                return shots;
            }
        }
        return List.of(new ShotPlan(1, "01", configuredDuration(request, stringValue(storyboardOutput.output(), "duration", "8s")), request.message()));
    }

    private VideoGenerationStatus executeVideoGeneration(
            MutableAgentRun run,
            AgentRunRequest request,
            VideoAgentOutput visualOutput,
            VideoAgentOutput exportOutput,
            TaskResponse task,
            CanvasNodeResponse videoNode,
            List<ReferenceAsset> referenceAssets
    ) {
        String providerJobId;
        String prompt = withReferenceBrief(stringValue(visualOutput.output(), "content", request.message()), referenceAssets);
        String firstFramePrompt = stringValue(visualOutput.output(), "firstFramePrompt", "");
        String lastFramePrompt = stringValue(visualOutput.output(), "lastFramePrompt", "");
        String keyframePrompt = withReferenceBrief("""
                %s

                首帧：%s

                尾帧：%s
                """.formatted(
                stringValue(visualOutput.output(), "prompt", request.message()),
                firstFramePrompt.isBlank() ? "沿用分镜首帧设定" : firstFramePrompt,
                lastFramePrompt.isBlank() ? "沿用分镜尾帧设定" : lastFramePrompt
        ).trim(), referenceAssets);
        try {
            providerJobId = videoGenerationProvider.submit(new VideoGenerationRequest(
                    run.userId,
                    run.runId,
                    run.projectId,
                    run.canvasId,
                    videoNode.id(),
                    prompt,
                    keyframePrompt,
                    configuredDuration(request, stringValue(visualOutput.output(), "duration", stringValue(exportOutput.output(), "duration", "8s"))),
                    stringValue(exportOutput.output(), "model", "mock"),
                    request.videoModelConfigId(),
                    configuredAspectRatio(request),
                    configuredResolution(request),
                    configuredAudioEnabled(request),
                    configuredMultiCameraEnabled(request)
            ));
        } catch (RuntimeException ex) {
            String message = ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
            return skipVideoGeneration(run, task, videoNode, message);
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
                    return skipVideoGeneration(run, task, videoNode, "provider returned empty video");
                }
                return status;
            }
            if ("failed".equals(status.status())) {
                return skipVideoGeneration(run, task, videoNode, status.error() == null ? statusMessage : status.error());
            }
            sleep(2000);
        }
        return skipVideoGeneration(run, task, videoNode, "video provider timed out");
    }

    private Map<String, Object> generateKeyframeAsset(
            MutableAgentRun run,
            AgentRunRequest request,
            CanvasNodeResponse imageNode,
            VideoAgentOutput visualOutput,
            List<ReferenceAsset> referenceAssets
    ) {
        Map<String, Object> output = new java.util.LinkedHashMap<>();
        String prompt = withReferenceBrief(stringValue(visualOutput.output(), "prompt", request.message()), referenceAssets);
        try {
            ImageGenerationService.ImageResult keyframe = imageGenerationService.generate(run.userId, prompt, providerReferenceUrls(referenceAssets), request.imageModelConfigId(), usageContext(run, imageNode.id(), "agent.keyframe-image"));
            AssetResponse keyframeAsset = keyframe.url().isBlank()
                    ? assetService.createStoredAsset(run.projectId, run.canvasId, imageNode.id(), "image", "关键帧图", keyframe.bytes(), keyframe.contentType(), keyframe.extension())
                    : assetService.create(run.projectId, run.canvasId, imageNode.id(), "image", "关键帧图", keyframe.url(), keyframe.url());
            publish(run.runId, "asset.created", Map.of("asset", keyframeAsset));
            output.put("assetId", keyframeAsset.id());
            output.put("url", keyframeAsset.url());
            output.put("thumbnailUrl", keyframeAsset.thumbnailUrl());
            output.put("imageGenerationStatus", "success");
            output.put("referenceAssets", referenceAssetOutput(referenceAssets));
            output.putAll(keyframe.metadata());
        } catch (RuntimeException ex) {
            output.putIfAbsent("thumbnailUrl", stringValue(visualOutput.output(), "thumbnailUrl", ""));
            output.put("imageGenerationStatus", "skipped");
            output.put("imageGenerationError", ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage());
            output.put("referenceAssets", referenceAssetOutput(referenceAssets));
        }
        return output;
    }

    private Map<String, Object> generateKeyframeAssetWithTimeout(
            MutableAgentRun run,
            AgentRunRequest request,
            CanvasNodeResponse imageNode,
            VideoAgentOutput visualOutput,
            List<ReferenceAsset> referenceAssets
    ) {
        try {
            return mediaExecutorService.submit(() -> generateKeyframeAsset(run, request, imageNode, visualOutput, referenceAssets))
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

    private VideoGenerationStatus skipVideoGeneration(MutableAgentRun run, TaskResponse task, CanvasNodeResponse videoNode, String error) {
        String message = error == null || error.isBlank() ? "视频生成暂不可用" : error;
        TaskResponse skippedTask = taskService.update(task.id(), "success", 100, "视频模型暂不可用，已生成可追踪占位结果");
        publish(run.runId, "task.completed", Map.of("task", skippedTask));
        CanvasNodeResponse skippedNode = canvasService.updateNode(run.canvasId, videoNode.id(), "success", Map.of(
                "summary", "视频模型暂不可用，已生成可追踪占位结果",
                "videoGenerationStatus", "skipped",
                "videoGenerationError", message
        ));
        publishNodeUpdated(run, skippedNode);
        return new VideoGenerationStatus(
                "fallback-" + task.id(),
                "succeeded",
                100,
                "视频模型暂不可用，已生成可追踪占位结果",
                null,
                null,
                null,
                null,
                message
        );
    }

    private VideoAgentRuntime.VideoAgentRunListener listenerFor(MutableAgentRun run, AgentRunRequest request) {
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
                Map<String, Object> eventOutput = output == null
                        ? Map.of()
                        : normalizedStepOutput(output.output(), request, step.code());
                publish(run.runId, "agent.step.completed", Map.of(
                        "step", step.code(),
                        "title", step.title(),
                        "agentName", agentName,
                        "reason", reason.name(),
                        "content", output == null ? "" : output.text(),
                        "output", eventOutput
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

    private ModelUsageContext usageContext(MutableAgentRun run, String nodeId, String endpoint) {
        return new ModelUsageContext(run.runId, run.projectId, run.canvasId, nodeId, endpoint);
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
        CanvasNodeResponse currentNode = canvasService.getNode(run.canvasId, nodeId)
                .orElseThrow(() -> new IllegalArgumentException("canvas node not found: " + nodeId));
        List<ReferenceAsset> referenceAssets = referenceAssets(run.projectId);
        String assistantText = "我会基于你的指令重新生成当前节点：" + request.message();
        conversationService.addMessage(run.conversationId, run.projectId, "assistant", run.agentName, assistantText);
        publish(runId, "message.completed", Map.of(
                "role", "assistant",
                "sender", run.agentName,
                "content", assistantText
        ));

        CanvasNodeResponse runningNode = canvasService.updateNode(run.canvasId, nodeId, "running", Map.of(
                "prompt", request.message(),
                "step", "regenerate",
                "nodeType", currentNode.type(),
                "regeneratingAt", Instant.now().toString()
        ));
        publishNodeUpdated(run, runningNode);

        try {
            CanvasNodeResponse completedNode;
            if ("images".equals(currentNode.type())) {
                completedNode = executeImageBatchAction(run, request, 1, referenceAssets);
            } else if ("video".equals(currentNode.type())) {
                completedNode = executeImageToVideoAction(run, request);
            } else {
                completedNode = canvasService.updateNode(
                        run.canvasId,
                        nodeId,
                        "success",
                        regeneratedNodeOutput(run, request, currentNode, referenceAssets)
                );
            }
            publishNodeUpdated(run, completedNode);
        } catch (RuntimeException ex) {
            String error = ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
            CanvasNodeResponse failedNode = canvasService.mergeNodeOutput(run.canvasId, nodeId, "failed", Map.of(
                    "step", "regenerate",
                    "error", error,
                    "completedAt", Instant.now().toString()
            ));
            publishNodeUpdated(run, failedNode);
            throw ex;
        }

        mark(run, "success", null);
        publish(runId, "run.completed", Map.of(
                "runId", runId,
                "status", "success",
                "mode", "regenerate-node",
                "nodeId", nodeId
        ));
    }

    private boolean isNodeMediaAction(String mode) {
        return "image-variant".equals(mode) || "batch-image".equals(mode) || "image-to-video".equals(mode);
    }

    private void executeNodeMediaAction(MutableAgentRun run, AgentRunRequest request) {
        String runId = run.runId;
        String nodeId = request.nodeId();
        String mode = request.mode();
        String title = switch (mode) {
            case "image-to-video" -> "图生视频";
            case "batch-image" -> "批量生成图片";
            default -> "生成图片变体";
        };
        conversationService.addMessage(run.conversationId, run.projectId, "assistant", run.agentName, title + "已开始：" + request.message());
        publish(runId, "message.completed", Map.of(
                "role", "assistant",
                "sender", run.agentName,
                "content", title + "已开始，结果会写回当前画布节点和素材库。"
        ));
        publishNodeUpdated(run, canvasService.mergeNodeOutput(run.canvasId, nodeId, "running", Map.of(
                "action", mode,
                "prompt", request.message(),
                "startedAt", Instant.now().toString()
        )));

        try {
            List<ReferenceAsset> referenceAssets = referenceAssets(run.projectId);
            CanvasNodeResponse completedNode = "image-to-video".equals(mode)
                    ? executeImageToVideoAction(run, request)
                    : executeImageBatchAction(run, request, "batch-image".equals(mode) ? 4 : 1, referenceAssets);
            publishNodeUpdated(run, completedNode);
            conversationService.addMessage(run.conversationId, run.projectId, "assistant", run.agentName, title + "已完成。");
            publish(runId, "message.completed", Map.of(
                    "role", "assistant",
                    "sender", run.agentName,
                    "content", title + "已完成，已更新节点并写入素材库。"
            ));
            mark(run, "success", null);
            publish(runId, "run.completed", Map.of("runId", runId, "status", "success", "mode", mode, "nodeId", nodeId));
        } catch (RuntimeException ex) {
            String error = ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
            CanvasNodeResponse failedNode = canvasService.mergeNodeOutput(run.canvasId, nodeId, "failed", Map.of(
                    "action", mode,
                    "error", error,
                    "completedAt", Instant.now().toString()
            ));
            publishNodeUpdated(run, failedNode);
            mark(run, "failed", error);
            publish(runId, "run.failed", Map.of("runId", runId, "status", "failed", "mode", mode, "nodeId", nodeId, "error", error));
        }
    }

    private CanvasNodeResponse executeImageBatchAction(MutableAgentRun run, AgentRunRequest request, int count, List<ReferenceAsset> referenceAssets) {
        java.util.List<Map<String, Object>> images = new java.util.ArrayList<>();
        java.util.List<String> errors = new java.util.ArrayList<>();
        List<String> referenceUrls = providerReferenceUrls(referenceAssets);
        for (int index = 0; index < count; index++) {
            String prompt = count == 1
                    ? withReferenceBrief(request.message(), referenceAssets)
                    : withReferenceBrief(request.message() + "\n变体编号 " + (index + 1) + "：保持主体一致，调整构图、动作、光影或镜头距离。", referenceAssets);
            try {
                ImageGenerationService.ImageResult image = imageGenerationService.generate(
                        run.userId,
                        prompt,
                        referenceUrls,
                        request.imageModelConfigId(),
                        usageContext(run, request.nodeId(), "node." + request.mode())
                );
                AssetResponse asset = image.url().isBlank()
                        ? assetService.createStoredAsset(run.projectId, run.canvasId, request.nodeId(), "image", count == 1 ? "图片变体" : "批量图片 " + (index + 1), image.bytes(), image.contentType(), image.extension())
                        : assetService.create(run.projectId, run.canvasId, request.nodeId(), "image", count == 1 ? "图片变体" : "批量图片 " + (index + 1), image.url(), image.url());
                publish(run.runId, "asset.created", Map.of("asset", asset));
                Map<String, Object> item = new java.util.LinkedHashMap<>();
                item.put("assetId", asset.id());
                item.put("url", asset.url());
                item.put("thumbnailUrl", asset.thumbnailUrl());
                item.put("prompt", prompt);
                item.putAll(image.metadata());
                images.add(item);
            } catch (RuntimeException ex) {
                errors.add("第 " + (index + 1) + " 张失败：" + (ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage()));
            }
            CanvasNodeResponse progressNode = canvasService.mergeNodeOutput(run.canvasId, request.nodeId(), "running", Map.of(
                    "action", request.mode(),
                    "prompt", request.message(),
                    "images", images,
                    "imageGenerationErrors", errors,
                    "imageGenerationStatus", errors.isEmpty() ? "running" : "partial_running",
                    "progress", Math.round(((index + 1) * 100.0f) / count)
            ));
            publishNodeUpdated(run, progressNode);
        }
        if (images.isEmpty()) {
            throw new IllegalStateException(errors.isEmpty() ? "图片生成未返回可用资产" : String.join("；", errors));
        }
        return canvasService.mergeNodeOutput(run.canvasId, request.nodeId(), "success", Map.of(
                "action", request.mode(),
                "prompt", request.message(),
                "images", images,
                "imageGenerationErrors", errors,
                "imageGenerationStatus", errors.isEmpty() ? "success" : "partial_success",
                "referenceAssets", referenceAssetOutput(referenceAssets),
                "completedAt", Instant.now().toString()
        ));
    }

    private CanvasNodeResponse executeImageToVideoAction(MutableAgentRun run, AgentRunRequest request) {
        String providerJobId = videoGenerationProvider.submit(new VideoGenerationRequest(
                run.userId,
                run.runId,
                run.projectId,
                run.canvasId,
                request.nodeId(),
                request.message(),
                request.message(),
                configuredDuration(request, "8s"),
                "configured-video",
                request.videoModelConfigId(),
                configuredAspectRatio(request),
                configuredResolution(request),
                configuredAudioEnabled(request),
                configuredMultiCameraEnabled(request)
        ));
        publish(run.runId, "video.provider.submitted", Map.of(
                "providerJobId", providerJobId,
                "nodeId", request.nodeId()
        ));
        VideoGenerationStatus status = waitForNodeVideo(run, providerJobId);
        if (!"succeeded".equals(status.status()) || status.videoBytes() == null || status.videoBytes().length == 0) {
            throw new IllegalStateException(status.error() == null ? "视频 provider 未返回可用视频" : status.error());
        }
        AssetResponse asset = assetService.createStoredVideo(
                run.projectId,
                run.canvasId,
                request.nodeId(),
                "图生视频",
                status.videoBytes(),
                status.videoContentType(),
                status.thumbnailBytes(),
                status.thumbnailContentType()
        );
        publish(run.runId, "asset.created", Map.of("asset", asset));
        return canvasService.mergeNodeOutput(run.canvasId, request.nodeId(), "success", Map.of(
                "action", request.mode(),
                "prompt", request.message(),
                "assetId", asset.id(),
                "url", asset.url(),
                "thumbnailUrl", asset.thumbnailUrl(),
                "providerJobId", providerJobId,
                "videoGenerationStatus", "success",
                "parameters", generationSettingsOutput(request),
                "completedAt", Instant.now().toString()
        ));
    }

    private VideoGenerationStatus waitForNodeVideo(MutableAgentRun run, String providerJobId) {
        for (int attempt = 0; attempt < 180; attempt++) {
            ensureCanContinue(run);
            VideoGenerationStatus status = videoGenerationProvider.getStatus(providerJobId);
            if (status.terminal()) {
                return status;
            }
            sleep(2000);
        }
        throw new IllegalStateException("video provider timed out");
    }

    private Map<String, Object> regeneratedNodeOutput(
            MutableAgentRun run,
            AgentRunRequest request,
            CanvasNodeResponse node,
            List<ReferenceAsset> referenceAssets
    ) {
        String prompt = nodeRegenerationPrompt(request, node, referenceAssets);
        VideoAgentRuntime.VideoAgentRunListener listener = listenerFor(run, request);
        Map<String, Object> output = switch (node.type()) {
            case "script" -> videoAgentRuntime
                    .plan(run.userId, prompt, listener, request.textModelConfigId(), usageContext(run, node.id(), "node.regenerate.script"))
                    .require(VideoAgentStep.SCRIPT)
                    .output();
            case "character" -> enrichCharacterOutput(videoAgentRuntime
                    .design(run.userId, prompt, listener, request.textModelConfigId(), usageContext(run, node.id(), "node.regenerate.character"))
                    .require(VideoAgentStep.CHARACTER)
                    .output(), referenceAssets);
            case "storyboard" -> videoAgentRuntime
                    .design(run.userId, prompt, listener, request.textModelConfigId(), usageContext(run, node.id(), "node.regenerate.storyboard"))
                    .require(VideoAgentStep.STORYBOARD)
                    .output();
            case "audio" -> videoAgentRuntime
                    .design(run.userId, prompt, listener, request.textModelConfigId(), usageContext(run, node.id(), "node.regenerate.audio"))
                    .require(VideoAgentStep.AUDIO)
                    .output();
            case "final" -> videoAgentRuntime
                    .reviewAndExport(run.userId, prompt, listener, request.textModelConfigId(), usageContext(run, node.id(), "node.regenerate.final"))
                    .require(VideoAgentStep.EXPORT)
                    .output();
            default -> videoAgentRuntime
                    .plan(run.userId, prompt, listener, request.textModelConfigId(), usageContext(run, node.id(), "node.regenerate"))
                    .require(VideoAgentStep.SCRIPT)
                    .output();
        };
        Map<String, Object> next = new java.util.LinkedHashMap<>(output);
        next.put("prompt", request.message());
        next.put("regeneratedFromNodeId", node.id());
        next.put("regeneratedAt", Instant.now().toString());
        if (!referenceAssets.isEmpty()) {
            next.put("referenceAssets", referenceAssetOutput(referenceAssets));
        }
        return normalizedStepOutput(next, request, node.type());
    }

    private String nodeRegenerationPrompt(AgentRunRequest request, CanvasNodeResponse node, List<ReferenceAsset> referenceAssets) {
        String currentOutput = compactJson(node.output(), 1800);
        String prompt = """
                请真实重新生成画布节点，不要只改状态或返回占位文本。
                节点标题：%s
                节点类型：%s
                用户指令：%s
                当前节点输出：%s
                """.formatted(node.title(), node.type(), request.message(), currentOutput).trim();
        return withReferenceBrief(prompt, referenceAssets);
    }

    private String compactJson(Map<String, Object> value, int maxLength) {
        if (value == null || value.isEmpty()) {
            return "{}";
        }
        String compact = String.valueOf(value);
        return compact.length() <= maxLength ? compact : compact.substring(0, maxLength) + "...";
    }

    private static String stringValue(Map<String, Object> output, String key, String fallback) {
        Object value = output.get(key);
        if (value instanceof String string && !string.isBlank()) {
            return string;
        }
        return fallback;
    }

    private static String configuredAspectRatio(AgentRunRequest request) {
        String value = request.aspectRatio();
        if (value == null || value.isBlank()) {
            return "16:9";
        }
        return switch (value.trim()) {
            case "16:9", "4:3", "1:1", "3:4", "9:16" -> value.trim();
            default -> "16:9";
        };
    }

    private static String configuredResolution(AgentRunRequest request) {
        String value = request.resolution();
        return value != null && value.equalsIgnoreCase("1080p") ? "1080p" : "720p";
    }

    private static String configuredDuration(AgentRunRequest request, String fallback) {
        Integer seconds = request.durationSeconds();
        if (seconds == null || seconds < 1) {
            return fallback == null || fallback.isBlank() ? "5s" : fallback;
        }
        int clamped = Math.max(1, Math.min(seconds, 30));
        return clamped + "s";
    }

    private static boolean configuredAudioEnabled(AgentRunRequest request) {
        return request.audioEnabled() == null || request.audioEnabled();
    }

    private static boolean configuredMultiCameraEnabled(AgentRunRequest request) {
        return Boolean.TRUE.equals(request.multiCameraEnabled());
    }

    private static Map<String, Object> generationSettingsOutput(AgentRunRequest request) {
        return Map.of(
                "aspectRatio", configuredAspectRatio(request),
                "resolution", configuredResolution(request),
                "duration", configuredDuration(request, "5s"),
                "audioEnabled", configuredAudioEnabled(request),
                "multiCameraEnabled", configuredMultiCameraEnabled(request)
        );
    }

    private static Map<String, Object> normalizedStepOutput(Map<String, Object> output, AgentRunRequest request, String step) {
        Map<String, Object> next = new java.util.LinkedHashMap<>(output == null ? Map.of() : output);
        Map<String, Object> settings = generationSettingsOutput(request);
        next.put("parameters", settings);
        if ("script".equals(step)) {
            next.put("durationSeconds", request.durationSeconds() == null ? 5 : Math.max(1, Math.min(request.durationSeconds(), 30)));
        }
        if ("storyboard".equals(step)) {
            Object scenes = next.get("scenes");
            if (scenes instanceof List<?> items) {
                next.put("scenes", items.stream()
                        .map(item -> normalizeSceneDuration(item, request))
                        .toList());
            }
            next.put("duration", configuredDuration(request, "5s"));
        }
        if ("audio".equals(step)) {
            next.put("duration", configuredDuration(request, "5s"));
            next.put("audioEnabled", configuredAudioEnabled(request));
        }
        return next;
    }

    private static Object normalizeSceneDuration(Object item, AgentRunRequest request) {
        if (!(item instanceof Map<?, ?> scene)) {
            return item;
        }
        Map<String, Object> next = new java.util.LinkedHashMap<>();
        scene.forEach((key, value) -> {
            if (key instanceof String stringKey && value != null) {
                next.put(stringKey, value);
            }
        });
        next.put("duration", configuredDuration(request, mapString(scene, "duration", "5s")));
        return next;
    }

    private static String withGenerationSettings(String prompt, AgentRunRequest request) {
        return """
                %s

                生成配置：
                - 画面比例：%s
                - 分辨率：%s
                - 单段视频时长：%s
                - 音效：%s
                - 多镜头：%s
                """.formatted(
                prompt == null ? "" : prompt,
                configuredAspectRatio(request),
                configuredResolution(request),
                configuredDuration(request, "5s"),
                configuredAudioEnabled(request) ? "开启" : "关闭",
                configuredMultiCameraEnabled(request) ? "开启" : "关闭"
        ).trim();
    }

    private static String mapString(Map<?, ?> output, String key, String fallback) {
        Object value = output.get(key);
        if (value instanceof String string && !string.isBlank()) {
            return string;
        }
        if (value instanceof Number || value instanceof Boolean) {
            return String.valueOf(value);
        }
        return fallback;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private List<ReferenceAsset> referenceAssets(String projectId) {
        return assetService.listReferenceImages(projectId, 6).stream()
                .map(asset -> new ReferenceAsset(
                        asset.id(),
                        asset.name(),
                        asset.url(),
                        asset.thumbnailUrl(),
                        isProviderAccessible(asset.url()) ? asset.url() : isProviderAccessible(asset.thumbnailUrl()) ? asset.thumbnailUrl() : ""
                ))
                .toList();
    }

    private String scriptConfirmationMessage(List<ReferenceAsset> referenceAssets) {
        if (referenceAssets.isEmpty()) {
            return "剧本草稿已生成，请确认后继续角色、分镜和关键帧设计。";
        }
        return "剧本草稿已生成。已检测到 " + referenceAssets.size() + " 张项目参考图，确认后会优先参考这些角色/风格图片继续角色、分镜和关键帧设计。";
    }

    private static String approvedScriptBrief(String originalPrompt, Map<String, Object> scriptOutput, String confirmationComment, List<ReferenceAsset> referenceAssets) {
        String summary = stringValue(scriptOutput, "summary", "");
        String style = stringValue(scriptOutput, "style", "");
        Object beats = scriptOutput.get("beats");
        StringBuilder brief = new StringBuilder(originalPrompt == null ? "" : originalPrompt);
        brief.append("\n\n请以后续节点严格延续这个已确认剧本，不要改换主体、角色或场景。");
        if (!summary.isBlank()) {
            brief.append("\n\n确认后的剧本摘要：").append(summary);
        }
        if (!style.isBlank()) {
            brief.append("\n风格：").append(style);
        }
        if (beats instanceof Iterable<?> items) {
            brief.append("\n关键节拍：");
            int index = 1;
            for (Object item : items) {
                if (item != null) {
                    brief.append("\n").append(index++).append(". ").append(item);
                }
            }
        }
        if (confirmationComment != null && !confirmationComment.isBlank() && !"前端确认继续".equals(confirmationComment)) {
            brief.append("\n\n用户确认备注/修改意见：").append(confirmationComment);
            brief.append("\n备注只能作为增量修改意见，不得覆盖上面的原始需求、主体和已确认剧本。");
        }
        return withReferenceBrief(brief.toString(), referenceAssets);
    }

    private static String withReferenceBrief(String prompt, List<ReferenceAsset> referenceAssets) {
        if (referenceAssets == null || referenceAssets.isEmpty()) {
            return prompt;
        }
        StringBuilder brief = new StringBuilder(prompt == null ? "" : prompt);
        brief.append("\n\n参考图约束：优先保持以下项目图片中的角色外观、主体设定、色彩风格和可识别特征。");
        int index = 1;
        for (ReferenceAsset asset : referenceAssets) {
            brief.append("\n").append(index++).append(". ").append(asset.name())
                    .append("（assetId=").append(asset.id()).append("）");
        }
        return brief.toString();
    }

    private static List<Map<String, Object>> referenceAssetOutput(List<ReferenceAsset> referenceAssets) {
        if (referenceAssets == null || referenceAssets.isEmpty()) {
            return List.of();
        }
        return referenceAssets.stream()
                .map(asset -> {
                    Map<String, Object> item = new java.util.LinkedHashMap<>();
                    item.put("id", asset.id());
                    item.put("name", asset.name());
                    item.put("url", asset.url());
                    item.put("thumbnailUrl", asset.thumbnailUrl());
                    item.put("providerAccessible", !asset.providerUrl().isBlank());
                    return item;
                })
                .toList();
    }

    private static Map<String, Object> frameOutput(FrameResult frame) {
        Map<String, Object> output = new java.util.LinkedHashMap<>();
        output.put("nodeId", frame.node().id());
        output.put("url", stringValue(frame.output(), "url", ""));
        output.put("thumbnailUrl", stringValue(frame.output(), "thumbnailUrl", ""));
        output.put("prompt", stringValue(frame.output(), "prompt", ""));
        output.put("frameKind", stringValue(frame.output(), "frameKind", ""));
        output.put("frameTitle", stringValue(frame.output(), "frameTitle", ""));
        output.put("imageGenerationStatus", stringValue(frame.output(), "imageGenerationStatus", ""));
        String error = stringValue(frame.output(), "imageGenerationError", "");
        if (!error.isBlank()) {
            output.put("imageGenerationError", error);
        }
        return output;
    }

    private static Map<String, Object> enrichCharacterOutput(Map<String, Object> output, List<ReferenceAsset> referenceAssets) {
        if (referenceAssets == null || referenceAssets.isEmpty()) {
            return enrichCharacterDesignSheets(output);
        }
        Map<String, Object> next = new java.util.LinkedHashMap<>(output);
        List<Map<String, Object>> referenceOutput = referenceAssetOutput(referenceAssets);
        next.put("referenceAssets", referenceOutput);
        Object characters = output.get("characters");
        if (!(characters instanceof List<?> items) || items.isEmpty()) {
            next.put("characters", referenceAssets.stream()
                    .map(asset -> Map.<String, Object>of(
                            "name", asset.name(),
                            "prompt", "参考项目素材 " + asset.name() + "，保持图片中的角色外观、轮廓、色彩和可识别特征。",
                            "images", List.of(referenceDisplayUrl(asset)),
                            "sourceAssetId", asset.id(),
                            "designSheet", defaultCharacterDesignSheet(asset.name())
                    ))
                    .toList());
            return next;
        }
        java.util.ArrayList<Map<String, Object>> enrichedCharacters = new java.util.ArrayList<>();
        int index = 0;
        for (Object item : items) {
            if (item instanceof Map<?, ?> character) {
                Map<String, Object> enriched = new java.util.LinkedHashMap<>();
                character.forEach((key, value) -> {
                    if (key instanceof String stringKey && value != null) {
                        enriched.put(stringKey, value);
                    }
                });
                ReferenceAsset asset = referenceAssets.get(index % referenceAssets.size());
                enriched.putIfAbsent("sourceAssetId", asset.id());
                enriched.putIfAbsent("images", List.of(referenceDisplayUrl(asset)));
                enriched.putIfAbsent("referenceAsset", referenceOutput.get(index % referenceOutput.size()));
                enriched.putIfAbsent("designSheet", defaultCharacterDesignSheet(String.valueOf(enriched.getOrDefault("name", asset.name()))));
                enrichedCharacters.add(enriched);
                index++;
            }
        }
        next.put("characters", enrichedCharacters);
        return enrichCharacterDesignSheets(next);
    }

    private static Map<String, Object> enrichCharacterDesignSheets(Map<String, Object> output) {
        Object characters = output.get("characters");
        if (!(characters instanceof List<?> items) || items.isEmpty()) {
            return output;
        }
        Map<String, Object> next = new java.util.LinkedHashMap<>(output);
        java.util.ArrayList<Map<String, Object>> enrichedCharacters = new java.util.ArrayList<>();
        for (Object item : items) {
            if (item instanceof Map<?, ?> character) {
                Map<String, Object> enriched = new java.util.LinkedHashMap<>();
                character.forEach((key, value) -> {
                    if (key instanceof String stringKey && value != null) {
                        enriched.put(stringKey, value);
                    }
                });
                enriched.putIfAbsent("designSheet", defaultCharacterDesignSheet(String.valueOf(enriched.getOrDefault("name", "角色"))));
                enrichedCharacters.add(enriched);
            }
        }
        next.put("characters", enrichedCharacters);
        return next;
    }

    private static List<Map<String, Object>> defaultCharacterDesignSheet(String name) {
        return List.of(
                Map.of("label", "三视图", "description", name + " 的正面、侧面、背面设计，固定比例、轮廓、服装和关键识别点。"),
                Map.of("label", "表情组", "description", "开心、惊讶、专注、害怕等核心表情，保持脸部结构一致。"),
                Map.of("label", "动作姿态", "description", "站立、奔跑、转身、互动动作，适配后续分镜首尾帧。"),
                Map.of("label", "色板材质", "description", "主体颜色、服装材质、配饰和光影风格，用于统一关键帧。")
        );
    }

    private static String referenceDisplayUrl(ReferenceAsset asset) {
        return asset.thumbnailUrl() == null || asset.thumbnailUrl().isBlank() ? asset.url() : asset.thumbnailUrl();
    }

    private static List<String> providerReferenceUrls(List<ReferenceAsset> referenceAssets) {
        if (referenceAssets == null || referenceAssets.isEmpty()) {
            return List.of();
        }
        return referenceAssets.stream()
                .map(ReferenceAsset::providerUrl)
                .filter(url -> !url.isBlank())
                .distinct()
                .toList();
    }

    private static boolean isProviderAccessible(String url) {
        return url != null && (url.startsWith("http://") || url.startsWith("https://"));
    }

    private record ReferenceAsset(
            String id,
            String name,
            String url,
            String thumbnailUrl,
            String providerUrl
    ) {
    }

    private record ShotPlan(
            int index,
            String shot,
            String duration,
            String content
    ) {
        String label() {
            return "Shot " + String.format("%02d", index);
        }
    }

    private record ClipResult(
            CanvasNodeResponse videoNode,
            TaskResponse task,
            AssetResponse asset,
            VideoGenerationStatus generation,
            Map<String, Object> output
    ) {
    }

    private record FrameResult(
            CanvasNodeResponse node,
            Map<String, Object> output
    ) {
    }

    private record PlannedFrame(
            CanvasNodeResponse node,
            VideoAgentOutput visualOutput
    ) {
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
                "16:9",
                null
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
        saveRun(run);
    }

    private void saveRun(MutableAgentRun run) {
        agentRunRepository.findById(run.runId)
                .ifPresentOrElse(
                        entity -> {
                            entity.update(run.status, run.error, run.checkpoint, run.updatedAt);
                            agentRunRepository.save(entity);
                        },
                        () -> agentRunRepository.save(new AgentRunEntity(
                                run.runId,
                                run.userId,
                                run.projectId,
                                run.conversationId,
                                run.canvasId,
                                run.status,
                                run.agentName,
                                run.message,
                                run.error,
                                run.checkpoint,
                                "/api/agent/runs/" + run.runId + "/events",
                                run.createdAt,
                                run.updatedAt
                        ))
                );
    }

    private AgentRunDetailResponse toDetail(AgentRunEntity run) {
        return new AgentRunDetailResponse(
                run.id(),
                run.projectId(),
                run.conversationId(),
                run.canvasId(),
                run.status(),
                run.agentName(),
                run.message(),
                run.error(),
                run.checkpoint(),
                run.streamUrl(),
                agentRunMonitor.snapshot(run.id()),
                sseHub.replay(run.id()),
                run.createdAt(),
                run.updatedAt()
        );
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
