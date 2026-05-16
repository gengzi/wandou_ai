package com.wandou.ai.agent.plan;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class VideoExecutionPlanCompilerTest {

    private final VideoExecutionPlanCompiler compiler = new VideoExecutionPlanCompiler();

    @Test
    void compilesCreativeGoalIntoVideoDagSkeleton() {
        Map<String, Object> plan = compiler.compile("生成一个太空站少女和机器伙伴的 8 秒视频");

        assertThat(plan).containsEntry("version", "video-dag-v1");
        assertThat(plan.get("goal")).isEqualTo("生成一个太空站少女和机器伙伴的 8 秒视频");
        assertThat(plan.get("nodes")).isInstanceOf(List.class);
        assertThat(plan.get("edges")).isInstanceOf(List.class);
        assertThat(plan.get("modelRouting")).isInstanceOf(Map.class);
        assertThat(plan.get("retryPolicy")).isInstanceOf(Map.class);
        assertThat(plan.get("editPolicy")).isInstanceOf(Map.class);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) plan.get("nodes");
        assertThat(nodes)
                .extracting(node -> node.get("owner"))
                .contains("ScriptAgent", "StoryboardAgent", "RenderWorker", "QualityAgent", "Assembler");
    }
}
