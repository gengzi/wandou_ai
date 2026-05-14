package com.wandou.ai.sse;

import com.wandou.ai.common.IdGenerator;

import java.time.Instant;

public record SseEvent(
        String id,
        String event,
        String runId,
        Object data,
        Instant createdAt
) {
    public static SseEvent of(String event, String runId, Object data) {
        return new SseEvent(IdGenerator.longId("evt_"), event, runId, data, Instant.now());
    }
}
