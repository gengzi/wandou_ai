package com.wandou.ai.agent.llm;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "wandou.ai.provider", name = "type", havingValue = "mock", matchIfMissing = true)
public class MockLlmProvider implements LlmProvider {

    @Override
    public String generate(String agentName, String message) {
        String name = agentName == null || agentName.isBlank() ? "导演" : agentName;
        return "我是" + name + "。我已理解你的需求：" + message + "。接下来会生成剧本节点、分镜节点和视频任务，并把结果同步到画布。";
    }
}
