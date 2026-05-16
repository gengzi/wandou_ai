package com.wandou.ai.usage.dto;

import java.time.Instant;

public record ModelUsageRecordResponse(
        String id,
        String runId,
        String projectId,
        String canvasId,
        String nodeId,
        String capability,
        String provider,
        String modelName,
        String modelDisplayName,
        String compatibilityMode,
        String endpoint,
        int requestCount,
        int inputChars,
        int outputChars,
        int credits,
        String status,
        String errorMessage,
        String providerRequestId,
        Instant createdAt,
        Instant completedAt,
        long durationMs
) {
}
