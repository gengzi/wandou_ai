package com.wandou.ai.agent;

import com.wandou.ai.agent.dto.AgentRunDetailResponse;
import com.wandou.ai.agent.dto.AgentRunRequest;
import com.wandou.ai.agent.dto.AgentRunResponse;
import com.wandou.ai.agent.llm.LlmProvider;
import com.wandou.ai.asset.AssetService;
import com.wandou.ai.asset.dto.AssetResponse;
import com.wandou.ai.canvas.dto.CanvasEdgeResponse;
import com.wandou.ai.canvas.CanvasService;
import com.wandou.ai.canvas.dto.CanvasNodeResponse;
import com.wandou.ai.canvas.dto.PositionResponse;
import com.wandou.ai.common.IdGenerator;
import com.wandou.ai.conversation.ConversationService;
import com.wandou.ai.conversation.dto.ConversationResponse;
import com.wandou.ai.project.ProjectService;
import com.wandou.ai.project.dto.ProjectResponse;
import com.wandou.ai.sse.SseEvent;
import com.wandou.ai.sse.SseHub;
import com.wandou.ai.task.TaskService;
import com.wandou.ai.task.dto.TaskResponse;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class AgentRunService {

    private final LlmProvider llmProvider;
    private final SseHub sseHub;
    private final ProjectService projectService;
    private final CanvasService canvasService;
    private final ConversationService conversationService;
    private final TaskService taskService;
    private final AssetService assetService;
    private final Map<String, MutableAgentRun> runs = new ConcurrentHashMap<>();
    private final ExecutorService executorService = Executors.newFixedThreadPool(4);

    public AgentRunService(
            LlmProvider llmProvider,
            SseHub sseHub,
            ProjectService projectService,
            CanvasService canvasService,
            ConversationService conversationService,
            TaskService taskService,
            AssetService assetService
    ) {
        this.llmProvider = llmProvider;
        this.sseHub = sseHub;
        this.projectService = projectService;
        this.canvasService = canvasService;
        this.conversationService = conversationService;
        this.taskService = taskService;
        this.assetService = assetService;
    }

    public AgentRunResponse start(AgentRunRequest request) {
        ProjectResponse project = resolveProject(request.projectId());
        ConversationResponse conversation = conversationService.getOrCreate(request.conversationId(), project.id());
        String canvasId = valueOrDefault(request.canvasId(), project.canvasId());
        String runId = IdGenerator.longId("run_");
        MutableAgentRun run = new MutableAgentRun(
                runId,
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
        conversationService.addMessage(conversation.id(), project.id(), "user", "用户", request.message());
        executorService.submit(() -> execute(run, request));
        return new AgentRunResponse(runId, conversation.id(), canvasId, "running", "/api/agent/runs/" + runId + "/events");
    }

    public Optional<AgentRunDetailResponse> get(String runId) {
        MutableAgentRun run = runs.get(runId);
        return run == null ? Optional.empty() : Optional.of(run.toDetail(sseHub.replay(runId)));
    }

    private void execute(MutableAgentRun run, AgentRunRequest request) {
        String runId = run.runId;
        mark(run, "running", null);
        sleep(300);
        publish(runId, "run.started", Map.of(
                "runId", runId,
                "projectId", run.projectId,
                "conversationId", run.conversationId,
                "canvasId", run.canvasId
        ));

        sleep(500);
        publish(runId, "message.delta", Map.of(
                "role", "assistant",
                "sender", run.agentName,
                "content", "我先理解你的创作需求，并拆成剧本、分镜和视频任务。"
        ));

        try {
            if ("regenerate-node".equals(request.mode()) && request.nodeId() != null && !request.nodeId().isBlank()) {
                executeNodeRegeneration(run, request);
                return;
            }

            String assistantText = llmProvider.generate(run.agentName, request.message());
            conversationService.addMessage(run.conversationId, run.projectId, "assistant", run.agentName, assistantText);
            sleep(600);
            publish(runId, "message.completed", Map.of(
                    "role", "assistant",
                    "sender", run.agentName,
                    "content", assistantText
            ));

            sleep(400);
            CanvasNodeResponse scriptNode = updateNode(run, "script-1", "running", Map.of(
                    "prompt", request.message(),
                    "agentName", run.agentName,
                    "step", "script"
            ));

            sleep(700);
            CanvasNodeResponse updatedScriptNode = canvasService.updateNode(run.canvasId, scriptNode.id(), "success", Map.of(
                    "summary", "根据用户输入生成短视频剧本：" + request.message(),
                    "style", "电影感、AI 视频、分镜化",
                    "beats", java.util.List.of("开场建立空间与人物", "角色互动带出情绪", "镜头推进到核心奇观", "收束为可生成视频任务")
            ));
            publish(runId, "node.updated", Map.of(
                    "nodeId", updatedScriptNode.id(),
                    "status", updatedScriptNode.status(),
                    "output", updatedScriptNode.output()
            ));

            sleep(350);
            CanvasNodeResponse characterNode = updateNode(run, "char-1", "running", Map.of(
                    "sourceNodeId", scriptNode.id(),
                    "step", "character"
            ));

            sleep(650);
            CanvasNodeResponse updatedCharacterNode = canvasService.updateNode(run.canvasId, characterNode.id(), "success", Map.of(
                    "characters", java.util.List.of(
                            Map.of("name", "未来宇航少女", "prompt", "粉色长发、白色轻量宇航服、蓝色发光线条、温柔但坚定"),
                            Map.of("name", "机器伙伴", "prompt", "圆润金属外壳、蓝色电子眼、小型陪伴机器人、可爱且有情绪")
                    ),
                    "consistency", "主角、伙伴与服装材质会作为后续关键帧和视频提示词的固定引用。"
            ));
            publish(runId, "node.updated", Map.of(
                    "nodeId", updatedCharacterNode.id(),
                    "status", updatedCharacterNode.status(),
                    "output", updatedCharacterNode.output()
            ));

            sleep(400);
            CanvasNodeResponse storyboardNode = addNode(run,
                    run.canvasId,
                    "storyboard",
                    "分镜设计",
                    "running",
                    new PositionResponse(80, 500),
                    Map.of("sourceNodeId", scriptNode.id(), "step", "storyboard")
            );
            addEdge(run, scriptNode.id(), storyboardNode.id());
            addEdge(run, characterNode.id(), storyboardNode.id());

            sleep(700);
            CanvasNodeResponse updatedStoryboardNode = canvasService.updateNode(run.canvasId, storyboardNode.id(), "success", Map.of(
                    "scenes", java.util.List.of(
                            Map.of("shot", "01", "duration", "2s", "content", "空间站舷窗前建立场景，星云慢慢铺开。"),
                            Map.of("shot", "02", "duration", "3s", "content", "少女抱紧机器伙伴，镜头轻推，角色眼神反射星光。"),
                            Map.of("shot", "03", "duration", "3s", "content", "窗外星云流动，机器伙伴亮起蓝色光环，情绪到达高潮。")
                    ),
                    "camera", "自动混合推镜头、轻微横移和景深变化"
            ));
            publish(runId, "node.updated", Map.of(
                    "nodeId", updatedStoryboardNode.id(),
                    "status", updatedStoryboardNode.status(),
                    "output", updatedStoryboardNode.output()
            ));

            sleep(350);
            CanvasNodeResponse imageNode = updateNode(run, "img-1", "running", Map.of(
                    "sourceNodeId", storyboardNode.id(),
                    "step", "keyframe"
            ));

            sleep(650);
            CanvasNodeResponse updatedImageNode = canvasService.updateNode(run.canvasId, imageNode.id(), "success", Map.of(
                    "prompt", "cinematic space station window, nebula outside, astronaut girl holding cute robot companion, consistent character design, 16:9",
                    "thumbnailUrl", "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900&auto=format&fit=crop",
                    "frames", java.util.List.of("建立镜头关键帧", "角色情绪关键帧", "星云奇观关键帧")
            ));
            publish(runId, "node.updated", Map.of(
                    "nodeId", updatedImageNode.id(),
                    "status", updatedImageNode.status(),
                    "output", updatedImageNode.output()
            ));

            sleep(400);
            CanvasNodeResponse videoNode = addNode(run,
                    run.canvasId,
                    "video",
                    "图生视频任务",
                    "running",
                    new PositionResponse(1300, 120),
                    Map.of("sourceNodeId", imageNode.id(), "step", "video")
            );
            addEdge(run, storyboardNode.id(), videoNode.id());
            addEdge(run, imageNode.id(), videoNode.id());

            TaskResponse task = taskService.create(runId, run.projectId, run.canvasId, videoNode.id(), "video");
            publish(runId, "task.created", Map.of("task", task));

            for (int progress : new int[]{10, 35, 65, 90}) {
                sleep(500);
                TaskResponse updatedTask = taskService.update(
                        task.id(),
                        "running",
                        progress,
                        "正在生成视频，当前进度 " + progress + "%"
                );
                publish(runId, "task.progress", Map.of("task", updatedTask));
            }

            AssetResponse asset = assetService.create(
                    run.projectId,
                    run.canvasId,
                    videoNode.id(),
                    "video",
                    "AI 生成视频 Demo",
                    "https://example.com/demo-video.mp4",
                    "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800&auto=format&fit=crop"
            );
            TaskResponse completedTask = taskService.update(task.id(), "success", 100, "视频生成完成");
            sleep(400);
            publish(runId, "asset.created", Map.of("asset", asset));
            publish(runId, "task.completed", Map.of("task", completedTask));

            sleep(200);
            CanvasNodeResponse updatedVideoNode = canvasService.updateNode(run.canvasId, videoNode.id(), "success", Map.of(
                    "assetId", asset.id(),
                    "thumbnailUrl", asset.thumbnailUrl(),
                    "url", asset.url(),
                    "duration", "8s",
                    "model", "Mock Video Provider"
            ));
            publish(runId, "node.updated", Map.of(
                    "nodeId", updatedVideoNode.id(),
                    "status", updatedVideoNode.status(),
                    "output", updatedVideoNode.output()
            ));

            sleep(250);
            CanvasNodeResponse audioNode = updateNode(run, "audio-1", "running", Map.of(
                    "sourceNodeId", storyboardNode.id(),
                    "step", "audio"
            ));
            sleep(450);
            CanvasNodeResponse updatedAudioNode = canvasService.updateNode(run.canvasId, audioNode.id(), "success", Map.of(
                    "prompt", "空灵电子氛围、低频脉冲、轻微空间站机械声",
                    "duration", "8s"
            ));
            publish(runId, "node.updated", Map.of(
                    "nodeId", updatedAudioNode.id(),
                    "status", updatedAudioNode.status(),
                    "output", updatedAudioNode.output()
            ));

            sleep(300);
            CanvasNodeResponse finalNode = addNode(run,
                    run.canvasId,
                    "final",
                    "成片合成",
                    "success",
                    new PositionResponse(1300, 500),
                    Map.of("sourceNodeId", videoNode.id(), "step", "compose")
            );
            CanvasNodeResponse updatedFinalNode = canvasService.updateNode(run.canvasId, finalNode.id(), "success", Map.of(
                    "assetId", asset.id(),
                    "thumbnailUrl", asset.thumbnailUrl(),
                    "url", asset.url(),
                    "summary", "已把剧本、角色、分镜、关键帧、视频与音频合成为可预览成片。"
            ));
            addEdge(run, videoNode.id(), finalNode.id());
            addEdge(run, audioNode.id(), finalNode.id());
            publish(runId, "node.updated", Map.of(
                    "nodeId", updatedFinalNode.id(),
                    "status", updatedFinalNode.status(),
                    "output", updatedFinalNode.output()
            ));

            sleep(100);
            mark(run, "success", null);
            publish(runId, "run.completed", Map.of(
                    "runId", runId,
                    "status", "success"
            ));
        } catch (RuntimeException ex) {
            mark(run, "failed", ex.getMessage());
            publish(runId, "run.failed", Map.of(
                    "runId", runId,
                    "status", "failed",
                    "error", ex.getMessage()
            ));
        }
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
        publish(runId, "node.updated", Map.of(
                "nodeId", runningNode.id(),
                "status", runningNode.status(),
                "output", runningNode.output()
        ));

        sleep(800);
        CanvasNodeResponse completedNode = canvasService.updateNode(run.canvasId, nodeId, "success", regeneratedOutput(request.message(), nodeId));
        publish(runId, "node.updated", Map.of(
                "nodeId", completedNode.id(),
                "status", completedNode.status(),
                "output", completedNode.output()
        ));

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
                "thumbnailUrl", "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900&auto=format&fit=crop",
                "summary", "已按当前节点指令重新生成结果。",
                "duration", "8s"
        );
    }

    @PreDestroy
    public void destroy() {
        executorService.shutdownNow();
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
        sseHub.send(runId, SseEvent.of(eventName, runId, data));
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
        publish(run.runId, "node.updated", Map.of(
                "nodeId", node.id(),
                "status", node.status(),
                "output", node.output()
        ));
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

    private static final class MutableAgentRun {
        private final String runId;
        private final String projectId;
        private final String conversationId;
        private final String canvasId;
        private final String agentName;
        private final String message;
        private final Instant createdAt;
        private String status;
        private String error;
        private Instant updatedAt;

        private MutableAgentRun(
                String runId,
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
                    "/api/agent/runs/" + runId + "/events",
                    events,
                    createdAt,
                    updatedAt
            );
        }
    }
}
