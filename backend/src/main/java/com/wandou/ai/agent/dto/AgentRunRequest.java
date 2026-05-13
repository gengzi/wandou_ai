package com.wandou.ai.agent.dto;

import jakarta.validation.constraints.NotBlank;

public record AgentRunRequest(
        String projectId,
        String conversationId,
        String canvasId,
        @NotBlank(message = "message is required")
        String message,
        String agentName
) {
}
