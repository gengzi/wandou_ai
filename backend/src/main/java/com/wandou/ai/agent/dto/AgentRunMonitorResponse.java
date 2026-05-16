package com.wandou.ai.agent.dto;

import java.time.Instant;
import java.util.List;

public record AgentRunMonitorResponse(
        String runId,
        String status,
        String currentStep,
        String bottleneckStep,
        long runDurationMs,
        int eventCount,
        int interruptionCount,
        int confirmationWaitCount,
        long totalConfirmationWaitMs,
        List<AgentStepMonitorResponse> steps,
        List<String> designSignals,
        Instant updatedAt
) {
}
