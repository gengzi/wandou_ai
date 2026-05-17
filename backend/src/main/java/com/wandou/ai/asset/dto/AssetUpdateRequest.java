package com.wandou.ai.asset.dto;

import jakarta.validation.constraints.NotBlank;

public record AssetUpdateRequest(
        String projectId,
        String canvasId,
        String nodeId,
        @NotBlank String type,
        @NotBlank String name,
        @NotBlank String url,
        String thumbnailUrl,
        String purpose
) {
}
