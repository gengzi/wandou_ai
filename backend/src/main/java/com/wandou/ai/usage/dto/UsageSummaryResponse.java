package com.wandou.ai.usage.dto;

import java.util.List;

public record UsageSummaryResponse(
        int initialCredits,
        long usedCredits,
        long remainingCredits,
        long requestCount,
        List<ModelUsageRecordResponse> recentRecords
) {
}
