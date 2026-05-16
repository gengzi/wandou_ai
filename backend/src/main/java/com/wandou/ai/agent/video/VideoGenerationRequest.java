package com.wandou.ai.agent.video;

public record VideoGenerationRequest(
        String userId,
        String runId,
        String projectId,
        String canvasId,
        String nodeId,
        String prompt,
        String keyframePrompt,
        String duration,
        String model
) {
}
