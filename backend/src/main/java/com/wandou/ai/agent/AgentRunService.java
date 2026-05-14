package com.wandou.ai.agent;

import com.wandou.ai.agent.dto.AgentRunDetailResponse;
import com.wandou.ai.agent.dto.AgentRunRequest;
import com.wandou.ai.agent.dto.AgentRunResponse;
import com.wandou.ai.agent.llm.LlmProvider;
import com.wandou.ai.asset.AssetService;
import com.wandou.ai.asset.dto.AssetResponse;
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
            String assistantText = llmProvider.generate(run.agentName, request.message());
            conversationService.addMessage(run.conversationId, run.projectId, "assistant", run.agentName, assistantText);
            sleep(600);
            publish(runId, "message.completed", Map.of(
                    "role", "assistant",
                    "sender", run.agentName,
                    "content", assistantText
            ));

            sleep(400);
            CanvasNodeResponse scriptNode = canvasService.addNode(
                    run.canvasId,
                    "script",
                    "智能剧本生成",
                    "running",
                    new PositionResponse(120, 120),
                    Map.of("prompt", request.message(), "agentName", run.agentName)
            );
            publish(runId, "node.created", Map.of(
                    "canvasId", run.canvasId,
                    "node", scriptNode
            ));

            sleep(700);
            CanvasNodeResponse updatedScriptNode = canvasService.updateNode(run.canvasId, scriptNode.id(), "success", Map.of(
                    "summary", "根据用户输入生成短视频剧本：" + request.message(),
                    "style", "电影感、AI 视频、分镜化"
            ));
            publish(runId, "node.updated", Map.of(
                    "nodeId", updatedScriptNode.id(),
                    "status", updatedScriptNode.status(),
                    "output", updatedScriptNode.output()
            ));

            sleep(400);
            CanvasNodeResponse videoNode = canvasService.addNode(
                    run.canvasId,
                    "video",
                    "视频生成任务",
                    "running",
                    new PositionResponse(640, 180),
                    Map.of("sourceNodeId", scriptNode.id())
            );
            publish(runId, "node.created", Map.of(
                    "canvasId", run.canvasId,
                    "node", videoNode
            ));

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
                    "url", asset.url()
            ));
            publish(runId, "node.updated", Map.of(
                    "nodeId", updatedVideoNode.id(),
                    "status", updatedVideoNode.status(),
                    "output", updatedVideoNode.output()
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
