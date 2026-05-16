package com.wandou.ai.canvas.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

import java.util.Map;

public record CanvasNodeCreateRequest(
        @NotBlank String type,
        @NotBlank String title,
        String status,
        @Valid PositionResponse position,
        Map<String, Object> data
) {
}
