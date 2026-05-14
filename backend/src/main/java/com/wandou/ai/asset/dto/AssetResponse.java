package com.wandou.ai.asset.dto;

import java.time.Instant;

public record AssetResponse(
        String id,
        String projectId,
        String canvasId,
        String nodeId,
        String type,
        String name,
        String url,
        String thumbnailUrl,
        Instant createdAt
) {
}
