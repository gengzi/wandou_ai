package com.wandou.ai.agent.runtime;

import java.util.Map;

public record VideoAgentOutput(
        VideoAgentStep step,
        String agentName,
        String text,
        Map<String, Object> output
) {
}
