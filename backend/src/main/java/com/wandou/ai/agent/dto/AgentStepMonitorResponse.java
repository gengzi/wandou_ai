package com.wandou.ai.agent.dto;

import java.time.Instant;

public record AgentStepMonitorResponse(
        String step,
        String title,
        String agentName,
        String status,
        String reason,
        String modelSource,
        Instant startedAt,
        Instant completedAt,
        long durationMs
) {
}
