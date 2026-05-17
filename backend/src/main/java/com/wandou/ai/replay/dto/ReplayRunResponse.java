package com.wandou.ai.replay.dto;

import com.wandou.ai.sse.SseEvent;

import java.time.Instant;
import java.util.List;

public record ReplayRunResponse(
        String runId,
        String status,
        String agentName,
        String message,
        String error,
        String checkpoint,
        List<SseEvent> events,
        Instant createdAt,
        Instant updatedAt
) {
}
