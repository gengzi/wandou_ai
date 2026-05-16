package com.wandou.ai.usage;

public record ModelUsageContext(
        String runId,
        String projectId,
        String canvasId,
        String nodeId,
        String endpoint
) {
    public static ModelUsageContext endpoint(String endpoint) {
        return new ModelUsageContext(null, null, null, null, endpoint);
    }
}
