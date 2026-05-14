package com.wandou.ai.task.dto;

import java.time.Instant;

public record TaskResponse(
        String id,
        String runId,
        String projectId,
        String canvasId,
        String nodeId,
        String type,
        String status,
        int progress,
        String message,
        Instant updatedAt
) {
}
