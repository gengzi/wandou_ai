package com.wandou.ai.usage.dto;

import java.util.List;

public record ModelUsageRecordPageResponse(
        List<ModelUsageRecordResponse> content,
        long totalElements,
        int totalPages,
        int page,
        int size
) {
}
