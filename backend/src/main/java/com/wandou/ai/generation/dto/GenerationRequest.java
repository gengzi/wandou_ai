package com.wandou.ai.generation.dto;

import jakarta.validation.constraints.NotBlank;

public record GenerationRequest(
        String projectId,
        String canvasId,
        String conversationId,
        @NotBlank String prompt,
        String modelConfigId,
        String aspectRatio,
        String resolution,
        Integer durationSeconds,
        Boolean audioEnabled,
        Boolean multiCameraEnabled
) {
}
