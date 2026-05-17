package com.wandou.ai.asset.dto;

import java.time.Instant;
import java.util.Map;

public record AssetResponse(
        String id,
        String projectId,
        String canvasId,
        String nodeId,
        String type,
        String name,
        String url,
        String thumbnailUrl,
        String purpose,
        String parseStatus,
        String parsedSummary,
        String parseError,
        Map<String, Object> metadata,
        Instant createdAt
) {
}
