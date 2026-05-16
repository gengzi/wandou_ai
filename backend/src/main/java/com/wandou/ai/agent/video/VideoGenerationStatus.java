package com.wandou.ai.agent.video;

public record VideoGenerationStatus(
        String providerJobId,
        String status,
        int progress,
        String message,
        byte[] videoBytes,
        String videoContentType,
        byte[] thumbnailBytes,
        String thumbnailContentType,
        String error
) {
    public boolean terminal() {
        return "succeeded".equals(status) || "failed".equals(status);
    }
}
