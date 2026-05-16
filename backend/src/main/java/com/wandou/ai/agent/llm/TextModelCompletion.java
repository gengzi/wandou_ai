package com.wandou.ai.agent.llm;

public record TextModelCompletion(
        String content,
        String provider,
        String modelName,
        String displayName
) {
}
