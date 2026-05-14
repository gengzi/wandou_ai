package com.wandou.ai.canvas.dto;

import java.time.Instant;
import java.util.List;

public record CanvasResponse(
        String id,
        String projectId,
        List<CanvasNodeResponse> nodes,
        List<CanvasEdgeResponse> edges,
        Instant updatedAt
) {
}
