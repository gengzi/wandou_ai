package com.wandou.ai.asset.dto;

import java.util.List;

public record AssetPageResponse(
        List<AssetResponse> content,
        long totalElements,
        int totalPages,
        int page,
        int size
) {
}
