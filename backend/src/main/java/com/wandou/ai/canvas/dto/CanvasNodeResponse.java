package com.wandou.ai.canvas.dto;

import java.time.Instant;
import java.util.Map;

public record CanvasNodeResponse(
        String id,
        String type,
        String title,
        String status,
        PositionResponse position,
        Map<String, Object> data,
        Map<String, Object> output,
        Instant updatedAt
) {
}
