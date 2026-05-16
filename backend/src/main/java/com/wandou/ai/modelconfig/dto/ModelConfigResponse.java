package com.wandou.ai.modelconfig.dto;

import java.time.Instant;

public record ModelConfigResponse(
        String id,
        String capability,
        String provider,
        String displayName,
        String baseUrl,
        String modelName,
        String compatibilityMode,
        String apiKeyPreview,
        boolean enabled,
        Instant createdAt,
        Instant updatedAt
) {
}
