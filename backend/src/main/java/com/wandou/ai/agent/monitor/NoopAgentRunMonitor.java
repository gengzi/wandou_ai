package com.wandou.ai.agent.monitor;

import com.wandou.ai.agent.dto.AgentRunMonitorResponse;
import com.wandou.ai.agent.runtime.VideoAgentOutput;
import com.wandou.ai.agent.runtime.VideoAgentStep;
import io.agentscope.core.message.GenerateReason;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Component
@ConditionalOnProperty(prefix = "wandou.ai.agent.monitor", name = "enabled", havingValue = "false")
public class NoopAgentRunMonitor implements AgentRunMonitor {
    @Override
    public void startRun(String runId, Instant startedAt, String status) {
    }

    @Override
    public void status(String runId, String status) {
    }

    @Override
    public void event(String runId, String eventName) {
    }

    @Override
    public void stepStarted(String runId, VideoAgentStep step, String agentName) {
    }

    @Override
    public void stepCompleted(String runId, VideoAgentStep step, String agentName, VideoAgentOutput output, GenerateReason reason) {
    }

    @Override
    public void confirmationRequired(String runId) {
    }

    @Override
    public void confirmationResolved(String runId) {
    }

    @Override
    public void interrupted(String runId) {
    }

    @Override
    public void resumed(String runId) {
    }

    @Override
    public void cancelled(String runId) {
    }

    @Override
    public AgentRunMonitorResponse snapshot(String runId) {
        return new AgentRunMonitorResponse(runId, "disabled", "", "", 0, 0, 0, 0, 0, List.of(), List.of("监控已关闭。"), Instant.now());
    }

    @Override
    public boolean shouldPublish(String runId, String eventName) {
        return false;
    }
}
