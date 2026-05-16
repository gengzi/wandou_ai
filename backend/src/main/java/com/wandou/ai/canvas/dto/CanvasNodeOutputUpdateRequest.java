package com.wandou.ai.canvas.dto;

import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record CanvasNodeOutputUpdateRequest(
        String status,
        @NotNull Map<String, Object> output
) {
}
