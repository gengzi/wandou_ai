package com.wandou.ai.agent.dto;

public record AgentRunResponse(
        String runId,
        String conversationId,
        String canvasId,
        String status,
        String streamUrl
) {
}
