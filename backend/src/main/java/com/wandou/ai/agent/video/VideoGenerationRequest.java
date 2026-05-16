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
        String model,
        String modelConfigId,
        String aspectRatio,
        String resolution,
        Boolean audioEnabled,
        Boolean multiCameraEnabled
) {
}
