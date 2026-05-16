package com.wandou.ai.agent.dto;

import com.wandou.ai.sse.SseEvent;

import java.time.Instant;
import java.util.List;

public record AgentRunDetailResponse(
        String runId,
        String projectId,
        String conversationId,
        String canvasId,
        String status,
        String agentName,
        String message,
        String error,
        String checkpoint,
        String streamUrl,
        AgentRunMonitorResponse monitor,
        List<SseEvent> events,
        Instant createdAt,
        Instant updatedAt
) {
}
