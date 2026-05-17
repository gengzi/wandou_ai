package com.wandou.ai.derivative.dto;

import com.wandou.ai.asset.dto.AssetResponse;
import com.wandou.ai.canvas.dto.CanvasNodeResponse;

public record DerivativeResponse(
        String kind,
        AssetResponse asset,
        AssetResponse mockupAsset,
        AssetResponse printAsset,
        CanvasNodeResponse node
) {
}
