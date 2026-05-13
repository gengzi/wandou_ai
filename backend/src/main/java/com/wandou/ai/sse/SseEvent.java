package com.wandou.ai.sse;

import java.time.Instant;

public record SseEvent(
        String event,
        String runId,
        Object data,
        Instant createdAt
) {
    public static SseEvent of(String event, String runId, Object data) {
        return new SseEvent(event, runId, data, Instant.now());
    }
}
