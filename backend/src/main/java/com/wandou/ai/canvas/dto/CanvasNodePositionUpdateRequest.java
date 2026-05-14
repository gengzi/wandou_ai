package com.wandou.ai.canvas.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record CanvasNodePositionUpdateRequest(
        @NotNull(message = "position is required")
        @Valid
        PositionResponse position
) {
}
