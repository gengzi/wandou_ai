package com.wandou.ai.agent.prompt;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PromptTemplateServiceTest {

    private final PromptTemplateService promptTemplateService = new PromptTemplateService();

    @Test
    void rendersVideoAgentPromptTemplateWithStableVersion() {
        PromptTemplateService.RenderedPrompt rendered = promptTemplateService.render("script_agent", Map.of(
                "user_prompt", "生成一个 8 秒产品视频",
                "project_context", "Wandou AI 测试项目"
        ));

        assertThat(rendered.name()).isEqualTo("script_agent.md");
        assertThat(rendered.version()).hasSize(12);
        assertThat(rendered.content()).contains("生成一个 8 秒产品视频");
        assertThat(rendered.content()).contains("Wandou AI 测试项目");
        assertThat(rendered.content()).contains("只返回一个 JSON 对象");
        assertThat(rendered.content()).doesNotContain("{{user_prompt}}");
    }
}
