package com.wandou.ai.project.dto;

import java.time.Instant;

public record ProjectResponse(
        String id,
        String name,
        String description,
        String aspectRatio,
        String canvasId,
        Instant createdAt
) {
}
