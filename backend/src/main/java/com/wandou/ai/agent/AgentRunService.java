package com.wandou.ai.agent;

import com.wandou.ai.agent.dto.AgentRunRequest;
import com.wandou.ai.agent.dto.AgentRunResponse;
import com.wandou.ai.agent.llm.LlmProvider;
import com.wandou.ai.sse.SseEvent;
import com.wandou.ai.sse.SseHub;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class AgentRunService {

    private final LlmProvider llmProvider;
    private final SseHub sseHub;
    private final ExecutorService executorService = Executors.newFixedThreadPool(4);

    public AgentRunService(LlmProvider llmProvider, SseHub sseHub) {
        this.llmProvider = llmProvider;
        this.sseHub = sseHub;
    }

    public AgentRunResponse start(AgentRunRequest request) {
        String runId = "run_" + UUID.randomUUID().toString().replace("-", "");
        String conversationId = valueOrNew(request.conversationId(), "conv_");
        String canvasId = valueOrNew(request.canvasId(), "canvas_");
        executorService.submit(() -> execute(runId, conversationId, canvasId, request));
        return new AgentRunResponse(runId, conversationId, canvasId, "running", "/api/agent/runs/" + runId + "/events");
    }

    public void execute(String runId, String conversationId, String canvasId, AgentRunRequest request) {
        sleep(300);
        sseHub.send(runId, SseEvent.of("run.started", runId, Map.of(
                "runId", runId,
                "conversationId", conversationId,
                "canvasId", canvasId
        )));

        sleep(500);
        sseHub.send(runId, SseEvent.of("message.delta", runId, Map.of(
                "role", "assistant",
                "sender", safeAgentName(request.agentName()),
                "content", "我先理解你的创作需求，并拆成剧本、分镜和视频任务。"
        )));

        String assistantText = llmProvider.generate(safeAgentName(request.agentName()), request.message());
        sleep(600);
        sseHub.send(runId, SseEvent.of("message.completed", runId, Map.of(
                "role", "assistant",
                "sender", safeAgentName(request.agentName()),
                "content", assistantText
        )));

        String scriptNodeId = "node_script_" + shortId();
        sleep(400);
        sseHub.send(runId, SseEvent.of("node.created", runId, Map.of(
                "canvasId", canvasId,
                "node", Map.of(
                        "id", scriptNodeId,
                        "type", "script",
                        "title", "智能剧本生成",
                        "status", "running",
                        "position", Map.of("x", 120, "y", 120)
                )
        )));

        sleep(700);
        sseHub.send(runId, SseEvent.of("node.updated", runId, Map.of(
                "nodeId", scriptNodeId,
                "status", "success",
                "output", Map.of(
                        "summary", "根据用户输入生成短视频剧本：" + request.message(),
                        "style", "电影感、AI 视频、分镜化"
                )
        )));

        String videoNodeId = "node_video_" + shortId();
        String taskId = "task_video_" + shortId();
        sleep(400);
        sseHub.send(runId, SseEvent.of("node.created", runId, Map.of(
                "canvasId", canvasId,
                "node", Map.of(
                        "id", videoNodeId,
                        "type", "images",
                        "title", "视频生成任务",
                        "status", "running",
                        "position", Map.of("x", 640, "y", 180)
                )
        )));

        for (int progress : new int[]{10, 35, 65, 90}) {
            sleep(500);
            sseHub.send(runId, SseEvent.of("task.progress", runId, Map.of(
                    "taskId", taskId,
                    "nodeId", videoNodeId,
                    "progress", progress,
                    "message", "正在生成视频，当前进度 " + progress + "%"
            )));
        }

        String assetId = "asset_video_" + shortId();
        sleep(400);
        sseHub.send(runId, SseEvent.of("asset.created", runId, Map.of(
                "asset", Map.of(
                        "id", assetId,
                        "nodeId", videoNodeId,
                        "type", "video",
                        "name", "AI 生成视频 Demo",
                        "url", "https://example.com/demo-video.mp4",
                        "thumbnailUrl", "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800&auto=format&fit=crop"
                )
        )));

        sleep(200);
        sseHub.send(runId, SseEvent.of("node.updated", runId, Map.of(
                "nodeId", videoNodeId,
                "status", "success",
                "output", Map.of("assetId", assetId)
        )));

        sleep(100);
        sseHub.send(runId, SseEvent.of("run.completed", runId, Map.of(
                "runId", runId,
                "status", "success"
        )));
    }

    @PreDestroy
    public void destroy() {
        executorService.shutdownNow();
    }

    private String valueOrNew(String value, String prefix) {
        if (value != null && !value.isBlank()) {
            return value;
        }
        return prefix + shortId();
    }

    private String safeAgentName(String agentName) {
        return agentName == null || agentName.isBlank() ? "导演" : agentName;
    }

    private String shortId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
