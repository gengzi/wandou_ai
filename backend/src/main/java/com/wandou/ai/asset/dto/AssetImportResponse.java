package com.wandou.ai.asset.dto;

import java.util.List;

public record AssetImportResponse(
        int scanned,
        int importedCount,
        int failedCount,
        List<AssetImportResult> results
) {
    public record AssetImportResult(
            String assetId,
            String name,
            String status,
            String message,
            String url
    ) {
    }
}
