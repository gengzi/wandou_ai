package com.wandou.ai.generation.dto;

import com.wandou.ai.asset.dto.AssetResponse;
import com.wandou.ai.canvas.dto.CanvasNodeResponse;

import java.util.Map;

public record GenerationResponse(
        String type,
        String message,
        AssetResponse asset,
        CanvasNodeResponse node,
        Map<String, Object> metadata
) {
}
