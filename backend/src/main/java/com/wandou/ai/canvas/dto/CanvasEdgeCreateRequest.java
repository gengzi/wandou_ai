package com.wandou.ai.canvas.dto;

import jakarta.validation.constraints.NotBlank;

public record CanvasEdgeCreateRequest(
        @NotBlank String source,
        @NotBlank String target
) {
}
