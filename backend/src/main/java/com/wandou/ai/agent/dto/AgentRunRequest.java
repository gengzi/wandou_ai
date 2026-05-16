package com.wandou.ai.agent.dto;

import jakarta.validation.constraints.NotBlank;

public record AgentRunRequest(
        String projectId,
        String conversationId,
        String canvasId,
        @NotBlank(message = "message is required")
        String message,
        String agentName,
        String mode,
        String nodeId,
        String textModelConfigId,
        String imageModelConfigId,
        String videoModelConfigId,
        String aspectRatio,
        String resolution,
        Integer durationSeconds,
        Boolean audioEnabled,
        Boolean multiCameraEnabled
) {
}
