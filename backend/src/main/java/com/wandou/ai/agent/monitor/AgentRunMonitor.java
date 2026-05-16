package com.wandou.ai.agent.monitor;

import com.wandou.ai.agent.dto.AgentRunMonitorResponse;
import com.wandou.ai.agent.runtime.VideoAgentOutput;
import com.wandou.ai.agent.runtime.VideoAgentStep;
import io.agentscope.core.message.GenerateReason;

import java.time.Instant;

public interface AgentRunMonitor {
    void startRun(String runId, Instant startedAt, String status);

    void status(String runId, String status);

    void event(String runId, String eventName);

    void stepStarted(String runId, VideoAgentStep step, String agentName);

    void stepCompleted(String runId, VideoAgentStep step, String agentName, VideoAgentOutput output, GenerateReason reason);

    void confirmationRequired(String runId);

    void confirmationResolved(String runId);

    void interrupted(String runId);

    void resumed(String runId);

    void cancelled(String runId);

    AgentRunMonitorResponse snapshot(String runId);

    boolean shouldPublish(String runId, String eventName);
}
