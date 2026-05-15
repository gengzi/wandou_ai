package com.wandou.ai.agent.runtime;

import io.agentscope.core.agent.AgentBase;
import io.agentscope.core.interruption.InterruptContext;
import io.agentscope.core.message.GenerateReason;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import io.agentscope.core.pipeline.FanoutPipeline;
import io.agentscope.core.pipeline.SequentialPipeline;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class VideoAgentRuntime {

    public VideoAgentOutputs plan(String prompt, VideoAgentRunListener listener) {
        Msg input = userMessage(prompt);
        SequentialPipeline pipeline = SequentialPipeline.builder()
                .addAgent(new TemplateVideoAgent(VideoAgentStep.DIRECTOR, listener))
                .addAgent(new TemplateVideoAgent(VideoAgentStep.SCRIPT, listener))
                .build();
        Msg script = pipeline.execute(input).block();
        return VideoAgentOutputs.from(List.of(script));
    }

    public VideoAgentOutputs design(String prompt, VideoAgentRunListener listener) {
        Msg input = userMessage(prompt);
        FanoutPipeline pipeline = FanoutPipeline.builder()
                .addAgent(new TemplateVideoAgent(VideoAgentStep.CHARACTER, listener))
                .addAgent(new TemplateVideoAgent(VideoAgentStep.STORYBOARD, listener))
                .addAgent(new TemplateVideoAgent(VideoAgentStep.VISUAL, listener))
                .addAgent(new TemplateVideoAgent(VideoAgentStep.AUDIO, listener))
                .concurrent()
                .build();
        List<Msg> results = pipeline.execute(input).block();
        return VideoAgentOutputs.from(results == null ? List.of() : results);
    }

    public VideoAgentOutputs reviewAndExport(String prompt, VideoAgentRunListener listener) {
        Msg input = userMessage(prompt);
        SequentialPipeline pipeline = SequentialPipeline.builder()
                .addAgent(new TemplateVideoAgent(VideoAgentStep.REVIEW, listener))
                .addAgent(new TemplateVideoAgent(VideoAgentStep.EXPORT, listener))
                .build();
        Msg export = pipeline.execute(input).block();
        return VideoAgentOutputs.from(List.of(export));
    }

    private Msg userMessage(String prompt) {
        return Msg.builder()
                .name("用户")
                .role(MsgRole.USER)
                .textContent(prompt)
                .build();
    }

    public interface VideoAgentRunListener {
        void onAgentActivated(AgentBase agent);

        void onAgentReleased(AgentBase agent);

        void onStepStarted(VideoAgentStep step, String agentName);

        void onStepCompleted(VideoAgentStep step, String agentName, VideoAgentOutput output, GenerateReason reason);
    }

    public record VideoAgentOutputs(Map<VideoAgentStep, VideoAgentOutput> byStep) {
        public static VideoAgentOutputs from(List<Msg> messages) {
            Map<VideoAgentStep, VideoAgentOutput> outputs = new LinkedHashMap<>();
            for (Msg message : messages) {
                VideoAgentOutput output = toOutput(message);
                if (output != null) {
                    outputs.put(output.step(), output);
                }
            }
            return new VideoAgentOutputs(outputs);
        }

        public VideoAgentOutput require(VideoAgentStep step) {
            VideoAgentOutput output = byStep.get(step);
            if (output == null) {
                throw new IllegalStateException("missing agent output: " + step.code());
            }
            return output;
        }
    }

    private static VideoAgentOutput toOutput(Msg message) {
        if (message == null || message.getMetadata() == null) {
            return null;
        }
        Object stepValue = message.getMetadata().get("step");
        if (!(stepValue instanceof String stepCode)) {
            return null;
        }
        VideoAgentStep step = null;
        for (VideoAgentStep candidate : VideoAgentStep.values()) {
            if (candidate.code().equals(stepCode)) {
                step = candidate;
                break;
            }
        }
        if (step == null) {
            return null;
        }
        Object outputValue = message.getMetadata().get("output");
        Map<String, Object> output = outputValue instanceof Map<?, ?> map ? normalizeMap(map) : Map.of();
        return new VideoAgentOutput(step, message.getName(), message.getTextContent(), output);
    }

    private static Map<String, Object> normalizeMap(Map<?, ?> map) {
        Map<String, Object> normalized = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            if (entry.getKey() instanceof String key && entry.getValue() != null) {
                normalized.put(key, entry.getValue());
            }
        }
        return normalized;
    }

    private static final class TemplateVideoAgent extends AgentBase {
        private final VideoAgentStep step;
        private final VideoAgentRunListener listener;

        private TemplateVideoAgent(VideoAgentStep step, VideoAgentRunListener listener) {
            super(step.title(), "Wandou video generation agent: " + step.code());
            this.step = step;
            this.listener = listener;
        }

        @Override
        protected Mono<Msg> doCall(List<Msg> msgs) {
            return Mono.defer(() -> {
                        if (listener != null) {
                            listener.onAgentActivated(this);
                            listener.onStepStarted(step, getName());
                        }
                        return checkInterruptedAsync();
                    })
                    .then(Mono.delay(Duration.ofMillis(delayMillis(step))))
                    .then(checkInterruptedAsync())
                    .then(Mono.fromSupplier(() -> buildMessage(msgs)))
                    .doOnNext(message -> {
                        if (listener != null) {
                            listener.onStepCompleted(step, getName(), toOutput(message), message.getGenerateReason());
                        }
                    })
                    .doFinally(signalType -> {
                        if (listener != null) {
                            listener.onAgentReleased(this);
                        }
                    });
        }

        @Override
        protected Mono<Msg> handleInterrupt(InterruptContext context, Msg... originalArgs) {
            Msg message = Msg.builder()
                    .name(getName())
                    .role(MsgRole.ASSISTANT)
                    .textContent(getName() + "已收到打断请求，当前步骤已暂停。")
                    .metadata(Map.of("step", step.code(), "output", Map.of("interrupted", true)))
                    .generateReason(GenerateReason.INTERRUPTED)
                    .build();
            if (listener != null) {
                listener.onStepCompleted(step, getName(), toOutput(message), GenerateReason.INTERRUPTED);
            }
            return Mono.just(message);
        }

        private Msg buildMessage(List<Msg> msgs) {
            String prompt = msgs == null || msgs.isEmpty() ? "" : msgs.get(msgs.size() - 1).getTextContent();
            Map<String, Object> output = outputFor(step, prompt);
            return Msg.builder()
                    .name(getName())
                    .role(MsgRole.ASSISTANT)
                    .textContent(textFor(step, prompt))
                    .metadata(Map.of("step", step.code(), "output", output))
                    .generateReason(GenerateReason.MODEL_STOP)
                    .build();
        }

        private static long delayMillis(VideoAgentStep step) {
            return switch (step) {
                case DIRECTOR, REVIEW -> 120;
                case CHARACTER, STORYBOARD, VISUAL, AUDIO -> 180;
                case SCRIPT, EXPORT -> 160;
            };
        }

        private static String textFor(VideoAgentStep step, String prompt) {
            return switch (step) {
                case DIRECTOR -> "导演已把需求拆成剧本、角色、分镜、关键帧、声音和成片任务：" + prompt;
                case SCRIPT -> "剧本已完成：围绕用户意图建立开场、推进、奇观高潮与收束。";
                case CHARACTER -> "角色设定已完成：主角与伙伴的视觉一致性约束已生成。";
                case STORYBOARD -> "分镜已完成：镜头时长、画面内容和运镜节奏已规划。";
                case VISUAL -> "关键帧提示词已完成：可进入图像/视频模型生成。";
                case AUDIO -> "声音设计已完成：氛围、节奏和音效层次已设定。";
                case REVIEW -> "审查完成：剧本、角色、分镜、关键帧和声音可以组成一次可执行的视频生成链路。";
                case EXPORT -> "成片合成计划完成：可以输出预览资产并进入人工复核。";
            };
        }

        private static Map<String, Object> outputFor(VideoAgentStep step, String prompt) {
            return switch (step) {
                case DIRECTOR -> Map.of(
                        "goal", prompt,
                        "plan", List.of("剧本", "角色", "分镜", "关键帧", "视频生成", "声音", "成片审查"),
                        "confirmationPoints", List.of("script", "storyboard", "final-review")
                );
                case SCRIPT -> Map.of(
                        "summary", "根据用户输入生成短视频剧本：" + prompt,
                        "style", "电影感、AI 视频、分镜化",
                        "beats", List.of("开场建立空间与人物", "角色互动带出情绪", "镜头推进到核心奇观", "收束为可生成视频任务")
                );
                case CHARACTER -> Map.of(
                        "characters", List.of(
                                Map.of("name", "未来宇航少女", "prompt", "粉色长发、白色轻量宇航服、蓝色发光线条、温柔但坚定"),
                                Map.of("name", "机器伙伴", "prompt", "圆润金属外壳、蓝色电子眼、小型陪伴机器人、可爱且有情绪")
                        ),
                        "consistency", "主角、伙伴与服装材质会作为后续关键帧和视频提示词的固定引用。"
                );
                case STORYBOARD -> Map.of(
                        "scenes", List.of(
                                Map.of("shot", "01", "duration", "2s", "content", "空间站舷窗前建立场景，星云慢慢铺开。"),
                                Map.of("shot", "02", "duration", "3s", "content", "少女抱紧机器伙伴，镜头轻推，角色眼神反射星光。"),
                                Map.of("shot", "03", "duration", "3s", "content", "窗外星云流动，机器伙伴亮起蓝色光环，情绪到达高潮。")
                        ),
                        "camera", "自动混合推镜头、轻微横移和景深变化"
                );
                case VISUAL -> Map.of(
                        "prompt", "cinematic space station window, nebula outside, astronaut girl holding cute robot companion, consistent character design, 16:9",
                        "thumbnailUrl", "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=900&auto=format&fit=crop",
                        "frames", List.of("建立镜头关键帧", "角色情绪关键帧", "星云奇观关键帧")
                );
                case AUDIO -> Map.of(
                        "prompt", "空灵电子氛围、低频脉冲、轻微空间站机械声",
                        "duration", "8s"
                );
                case REVIEW -> Map.of(
                        "checks", List.of("角色一致性", "分镜连续性", "提示词可执行性", "音画同步"),
                        "summary", "已通过基础质量审查，等待用户确认后进入成片合成。"
                );
                case EXPORT -> Map.of(
                        "summary", "已把剧本、角色、分镜、关键帧、视频与音频合成为可预览成片。",
                        "duration", "8s",
                        "model", "AgentScope Mock Video Provider"
                );
            };
        }
    }
}
