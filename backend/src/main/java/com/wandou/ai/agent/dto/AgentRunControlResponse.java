package com.wandou.ai.agent.dto;

public record AgentRunControlResponse(
        String runId,
        String status,
        String message
) {
}
