package com.wandou.ai.agent.llm;

public interface LlmProvider {

    String generate(String agentName, String message);
}
