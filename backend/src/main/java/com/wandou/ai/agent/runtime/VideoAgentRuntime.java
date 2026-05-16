package com.wandou.ai.agent.runtime;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wandou.ai.agent.llm.TextModelCompletion;
import com.wandou.ai.agent.llm.TextModelService;
import com.wandou.ai.agent.plan.VideoExecutionPlanCompiler;
import com.wandou.ai.agent.prompt.PromptTemplateService;
import com.wandou.ai.usage.ModelUsageContext;
import io.agentscope.core.agent.AgentBase;
import io.agentscope.core.interruption.InterruptContext;
import io.agentscope.core.message.GenerateReason;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import io.agentscope.core.pipeline.FanoutPipeline;
import io.agentscope.core.pipeline.SequentialPipeline;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class VideoAgentRuntime {

    private final TextModelService textModelService;
    private final ObjectMapper objectMapper;
    private final PromptTemplateService promptTemplateService;
    private final VideoExecutionPlanCompiler executionPlanCompiler;

    public VideoAgentRuntime(
            TextModelService textModelService,
            ObjectMapper objectMapper,
            PromptTemplateService promptTemplateService,
            VideoExecutionPlanCompiler executionPlanCompiler
    ) {
        this.textModelService = textModelService;
        this.objectMapper = objectMapper;
        this.promptTemplateService = promptTemplateService;
        this.executionPlanCompiler = executionPlanCompiler;
    }

    public VideoAgentOutputs plan(String userId, String prompt, VideoAgentRunListener listener) {
        return plan(userId, prompt, listener, ModelUsageContext.endpoint("agent.plan"));
    }

    public VideoAgentOutputs plan(String userId, String prompt, VideoAgentRunListener listener, ModelUsageContext usageContext) {
        return plan(userId, prompt, listener, null, usageContext);
    }

    public VideoAgentOutputs plan(String userId, String prompt, VideoAgentRunListener listener, String modelConfigId, ModelUsageContext usageContext) {
        Msg input = userMessage(prompt);
        SequentialPipeline pipeline = SequentialPipeline.builder()
                .addAgent(new TemplateVideoAgent(VideoAgentStep.DIRECTOR, listener, userId, textModelService, objectMapper, promptTemplateService, executionPlanCompiler, modelConfigId, usageContext))
                .addAgent(new TemplateVideoAgent(VideoAgentStep.SCRIPT, listener, userId, textModelService, objectMapper, promptTemplateService, executionPlanCompiler, modelConfigId, usageContext))
                .build();
        Msg script = pipeline.execute(input).block();
        return VideoAgentOutputs.from(List.of(script));
    }

    public VideoAgentOutputs design(String userId, String prompt, VideoAgentRunListener listener) {
        return design(userId, prompt, listener, ModelUsageContext.endpoint("agent.design"));
    }

    public VideoAgentOutputs design(String userId, String prompt, VideoAgentRunListener listener, ModelUsageContext usageContext) {
        return design(userId, prompt, listener, null, usageContext);
    }

    public VideoAgentOutputs design(String userId, String prompt, VideoAgentRunListener listener, String modelConfigId, ModelUsageContext usageContext) {
        Msg input = userMessage(prompt);
        FanoutPipeline pipeline = FanoutPipeline.builder()
                .addAgent(new TemplateVideoAgent(VideoAgentStep.CHARACTER, listener, userId, textModelService, objectMapper, promptTemplateService, executionPlanCompiler, modelConfigId, usageContext))
                .addAgent(new TemplateVideoAgent(VideoAgentStep.STORYBOARD, listener, userId, textModelService, objectMapper, promptTemplateService, executionPlanCompiler, modelConfigId, usageContext))
                .addAgent(new TemplateVideoAgent(VideoAgentStep.VISUAL, listener, userId, textModelService, objectMapper, promptTemplateService, executionPlanCompiler, modelConfigId, usageContext))
                .addAgent(new TemplateVideoAgent(VideoAgentStep.AUDIO, listener, userId, textModelService, objectMapper, promptTemplateService, executionPlanCompiler, modelConfigId, usageContext))
                .concurrent()
                .build();
        List<Msg> results = pipeline.execute(input).block();
        return VideoAgentOutputs.from(results == null ? List.of() : results);
    }

    public VideoAgentOutputs reviewAndExport(String userId, String prompt, VideoAgentRunListener listener) {
        return reviewAndExport(userId, prompt, listener, ModelUsageContext.endpoint("agent.review-export"));
    }

    public VideoAgentOutputs reviewAndExport(String userId, String prompt, VideoAgentRunListener listener, ModelUsageContext usageContext) {
        return reviewAndExport(userId, prompt, listener, null, usageContext);
    }

    public VideoAgentOutputs reviewAndExport(String userId, String prompt, VideoAgentRunListener listener, String modelConfigId, ModelUsageContext usageContext) {
        Msg input = userMessage(prompt);
        SequentialPipeline pipeline = SequentialPipeline.builder()
                .addAgent(new TemplateVideoAgent(VideoAgentStep.REVIEW, listener, userId, textModelService, objectMapper, promptTemplateService, executionPlanCompiler, modelConfigId, usageContext))
                .addAgent(new TemplateVideoAgent(VideoAgentStep.EXPORT, listener, userId, textModelService, objectMapper, promptTemplateService, executionPlanCompiler, modelConfigId, usageContext))
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
        private final String userId;
        private final TextModelService textModelService;
        private final ObjectMapper objectMapper;
        private final PromptTemplateService promptTemplateService;
        private final VideoExecutionPlanCompiler executionPlanCompiler;
        private final String modelConfigId;
        private final ModelUsageContext usageContext;

        private TemplateVideoAgent(VideoAgentStep step, VideoAgentRunListener listener) {
            this(step, listener, null);
        }

        private TemplateVideoAgent(VideoAgentStep step, VideoAgentRunListener listener, VideoExecutionPlanCompiler executionPlanCompiler) {
            this(step, listener, null, null, null, null, executionPlanCompiler, null, ModelUsageContext.endpoint("agent.step"));
        }

        private TemplateVideoAgent(
                VideoAgentStep step,
                VideoAgentRunListener listener,
                String userId,
                TextModelService textModelService,
                ObjectMapper objectMapper,
                PromptTemplateService promptTemplateService,
                VideoExecutionPlanCompiler executionPlanCompiler,
                String modelConfigId,
                ModelUsageContext usageContext
        ) {
            super(step.title(), "Wandou video generation agent: " + step.code());
            this.step = step;
            this.listener = listener;
            this.userId = userId;
            this.textModelService = textModelService;
            this.objectMapper = objectMapper;
            this.promptTemplateService = promptTemplateService;
            this.executionPlanCompiler = executionPlanCompiler;
            this.modelConfigId = modelConfigId;
            this.usageContext = usageContext;
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
            String prompt = sourcePrompt(msgs);
            ModelStepResult modelResult = generateWithTextModel(prompt);
            Map<String, Object> output = new LinkedHashMap<>(modelResult.output());
            output.put("sourcePrompt", cleanPrompt(prompt));
            if (step == VideoAgentStep.DIRECTOR && !output.containsKey("executionPlan")) {
                output.put("executionPlan", executionPlanCompiler == null ? Map.of() : executionPlanCompiler.compile(prompt));
            }
            return Msg.builder()
                    .name(getName())
                    .role(MsgRole.ASSISTANT)
                    .textContent(modelResult.text())
                    .metadata(Map.of("step", step.code(), "output", output))
                    .generateReason(GenerateReason.MODEL_STOP)
                    .build();
        }

        private ModelStepResult generateWithTextModel(String prompt) {
            if (textModelService == null) {
                throw new IllegalStateException("未启用真实文本模型服务，视频 Agent 停止执行。");
            }
            TextModelCompletion model;
            try {
                model = textModelService.generate(
                                userId,
                                getName(),
                                systemPromptFor(step, prompt),
                                userPromptFor(step, prompt),
                                modelConfigId,
                                stepUsageContext()
                        )
                        .orElseThrow(() -> new IllegalStateException("未配置可用的真实文本模型，请先在模型配置里启用 text 模型。"));
            } catch (RuntimeException ex) {
                Map<String, Object> fallbackOutput = new LinkedHashMap<>(outputFor(step, prompt, executionPlanCompiler));
                fallbackOutput.put("modelSource", "template-fallback");
                fallbackOutput.put("fallbackReason", ex.getMessage());
                return new ModelStepResult(textFor(step, prompt) + "（文本模型暂不可用，已回退到结构化模板。）", fallbackOutput);
            }
            Map<String, Object> modelOutput;
            try {
                modelOutput = parseModelOutput(model.content());
            } catch (IllegalStateException ex) {
                modelOutput = new LinkedHashMap<>(outputFor(step, prompt, executionPlanCompiler));
                modelOutput.put("modelSource", "template-fallback");
                modelOutput.put("fallbackReason", ex.getMessage());
                modelOutput.put("rawModelText", model.content());
                modelOutput.put("modelProvider", model.provider());
                modelOutput.put("modelName", model.modelName());
                modelOutput.put("modelDisplayName", model.displayName());
                return new ModelStepResult(textFor(step, prompt) + "（文本模型 JSON 解析失败，已回退到结构化模板。）", modelOutput);
            }
            modelOutput.put("modelSource", "configured-text-model");
            modelOutput.put("modelProvider", model.provider());
            modelOutput.put("modelName", model.modelName());
            modelOutput.put("modelDisplayName", model.displayName());
            return new ModelStepResult(modelText(step, modelOutput), modelOutput);
        }

        private ModelUsageContext stepUsageContext() {
            String endpoint = usageContext == null || usageContext.endpoint() == null || usageContext.endpoint().isBlank()
                    ? "agent." + step.code()
                    : usageContext.endpoint() + "." + step.code();
            return new ModelUsageContext(
                    usageContext == null ? null : usageContext.runId(),
                    usageContext == null ? null : usageContext.projectId(),
                    usageContext == null ? null : usageContext.canvasId(),
                    usageContext == null ? null : usageContext.nodeId(),
                    endpoint
            );
        }

        private Map<String, Object> parseModelOutput(String content) {
            if (objectMapper == null) {
                throw new IllegalStateException("JSON parser unavailable");
            }
            try {
                JsonNode root = objectMapper.readTree(extractJsonObject(content));
                Map<String, Object> output = new LinkedHashMap<>();
                if (root.isObject()) {
                    root.fields().forEachRemaining(entry -> output.put(entry.getKey(), objectMapper.convertValue(entry.getValue(), Object.class)));
                }
                output.put("rawModelText", content);
                return output;
            } catch (Exception ex) {
                throw new IllegalStateException(step.title() + " 未返回合法 JSON，视频 Agent 停止执行。", ex);
            }
        }

        private String systemPromptFor(VideoAgentStep step, String prompt) {
            if (step == VideoAgentStep.SCRIPT && promptTemplateService != null) {
                PromptTemplateService.RenderedPrompt rendered = promptTemplateService.render("script_agent", Map.of(
                        "user_prompt", cleanPrompt(prompt),
                        "project_context", "当前项目使用 Wandou AI 多 Agent 视频工作台，输出会进入角色、分镜、关键帧、视频任务和成片节点。"
                ));
                return rendered.content() + "\n\nPrompt template version: " + rendered.version();
            }
            return switch (step) {
                case DIRECTOR -> """
                        你是视频生成 Agent 的导演规划节点。只返回 JSON 对象，字段：goal、subject、plan（字符串数组）、confirmationPoints（字符串数组）。
                        plan 要按真实创作链路拆解，不要写模板套话。
                        """;
                case SCRIPT -> """
                        你是视频生成 Agent 的剧本策划节点。只返回 JSON 对象，字段：summary、style、beats（4 个具体可拍摄中文节拍）、targetAudience、durationSeconds。
                        """;
                case CHARACTER -> """
                        你是角色与道具一致性节点。只返回 JSON 对象，字段：characters（数组，每项含 name 和 prompt）、consistency。
                        prompt 要能直接约束后续图像/视频模型。
                        """;
                case STORYBOARD -> """
                        你是分镜导演节点。只返回 JSON 对象，字段：scenes（3-5 项数组，每项含 shot、duration、content）、camera。
                        content 必须具体到画面、动作、镜头或转场。
                        """;
                case VISUAL -> """
                        你是关键帧视觉提示词节点。只返回 JSON 对象，字段：prompt、frames（3-5 个中文关键帧描述）。
                        prompt 面向图像/视频模型，要包含主体、场景、光线、材质、镜头、比例。
                        """;
                case AUDIO -> """
                        你是声音设计节点。只返回 JSON 对象，字段：prompt、duration、mood。
                        描述配乐节奏、环境声和关键音效。
                        """;
                case REVIEW -> """
                        你是成片审查节点。只返回 JSON 对象，字段：checks（字符串数组）、summary。
                        检查角色、产品、分镜、提示词和音画同步是否可执行。
                        """;
                case EXPORT -> """
                        你是成片导出计划节点。只返回 JSON 对象，字段：summary、duration、model、assetName。
                        不要编造真实视频 URL，URL 会由资产服务生成。
                        """;
            };
        }

        private static String userPromptFor(VideoAgentStep step, String prompt) {
            return "当前节点：" + step.title() + "\n用户视频需求：\n" + cleanPrompt(prompt);
        }

        private static String modelText(VideoAgentStep step, Map<String, Object> output) {
            Object summary = output.get("summary");
            if (summary instanceof String string && !string.isBlank()) {
                return step.title() + "已由已配置文本模型生成：" + string;
            }
            return step.title() + "已由已配置文本模型生成。";
        }

        private String scriptSystemPrompt(String prompt) {
            PromptTemplateService.RenderedPrompt rendered = promptTemplateService.render("script_agent", Map.of(
                    "user_prompt", cleanPrompt(prompt),
                    "project_context", "当前项目使用 Wandou AI 多 Agent 视频工作台，输出会进入角色、分镜、关键帧、视频任务和成片节点。"
            ));
            return rendered.content() + "\n\nPrompt template version: " + rendered.version();
        }

        private static String scriptUserPrompt(String prompt) {
            return "用户视频需求：\n" + cleanPrompt(prompt);
        }

        private static String scriptText(Map<String, Object> output) {
            Object summary = output.get("summary");
            Object style = output.get("style");
            return "剧本已由已配置文本模型生成：" + summary + " 风格：" + style;
        }

        private static String extractJsonObject(String value) {
            String text = value == null ? "" : value.trim();
            int start = text.indexOf('{');
            int end = text.lastIndexOf('}');
            if (start >= 0 && end > start) {
                return text.substring(start, end + 1);
            }
            return text;
        }

        private static String textNode(JsonNode root, String field, String fallback) {
            String value = root.path(field).asText("");
            return value.isBlank() ? fallback : value;
        }

        private static Object listNode(JsonNode node, Object fallback) {
            if (!node.isArray() || node.isEmpty()) {
                return fallback;
            }
            java.util.ArrayList<String> values = new java.util.ArrayList<>();
            for (JsonNode item : node) {
                String value = item.asText("");
                if (!value.isBlank()) {
                    values.add(value);
                }
            }
            return values.isEmpty() ? fallback : values;
        }

        private static Object intNode(JsonNode root, String field, Object fallback) {
            JsonNode node = root.path(field);
            if (node.isInt() || node.isLong()) {
                return node.asInt();
            }
            String value = node.asText("");
            if (!value.isBlank()) {
                try {
                    return Integer.parseInt(value.replaceAll("[^0-9]", ""));
                } catch (NumberFormatException ignored) {
                    return fallback;
                }
            }
            return fallback;
        }

        private static String sourcePrompt(List<Msg> msgs) {
            if (msgs == null || msgs.isEmpty()) {
                return "";
            }
            for (Msg msg : msgs) {
                if (msg != null && msg.getRole() == MsgRole.USER && msg.getTextContent() != null && !msg.getTextContent().isBlank()) {
                    return msg.getTextContent();
                }
            }
            for (Msg msg : msgs) {
                if (msg == null || msg.getMetadata() == null) {
                    continue;
                }
                Object outputValue = msg.getMetadata().get("output");
                if (outputValue instanceof Map<?, ?> output
                        && output.get("sourcePrompt") instanceof String sourcePrompt
                        && !sourcePrompt.isBlank()) {
                    return sourcePrompt;
                }
            }
            Msg last = msgs.get(msgs.size() - 1);
            return last == null ? "" : last.getTextContent();
        }

        private static long delayMillis(VideoAgentStep step) {
            return switch (step) {
                case DIRECTOR, REVIEW -> 120;
                case CHARACTER, STORYBOARD, VISUAL, AUDIO -> 180;
                case SCRIPT, EXPORT -> 160;
            };
        }

        private static String textFor(VideoAgentStep step, String prompt) {
            String subject = subjectFor(prompt);
            return switch (step) {
                case DIRECTOR -> "导演已把需求拆成剧本、角色、分镜、关键帧、声音和成片任务：" + prompt;
                case SCRIPT -> "剧本已完成：围绕「" + subject + "」生成开场、推进、展示高潮与收束。";
                case CHARACTER -> "角色设定已完成：已为「" + subject + "」拆出主角、产品/道具和视觉一致性约束。";
                case STORYBOARD -> "分镜已完成：镜头时长、画面内容和运镜节奏已围绕「" + subject + "」规划。";
                case VISUAL -> "关键帧提示词已完成：已生成可交给图像/视频模型执行的「" + subject + "」视觉提示。";
                case AUDIO -> "声音设计已完成：已按「" + subject + "」配置氛围、节奏和音效层次。";
                case REVIEW -> "审查完成：「" + subject + "」的剧本、角色、分镜、关键帧和声音可以组成视频生成链路。";
                case EXPORT -> "成片合成计划完成：已输出「" + subject + "」的预览资产元数据。";
            };
        }

        private static Map<String, Object> outputFor(VideoAgentStep step, String prompt, VideoExecutionPlanCompiler executionPlanCompiler) {
            String cleanPrompt = cleanPrompt(prompt);
            String subject = subjectFor(cleanPrompt);
            String product = productFor(cleanPrompt);
            String scene = sceneFor(cleanPrompt);
            String style = styleFor(cleanPrompt);
            String duration = durationFor(cleanPrompt);
            int durationSeconds = durationSecondsFor(cleanPrompt);
            String thumbnail = previewDataUri(subject, product, style);
            return switch (step) {
                case DIRECTOR -> Map.of(
                        "goal", cleanPrompt,
                        "subject", subject,
                        "plan", List.of("剧本", "角色", "分镜", "关键帧", "视频生成", "声音", "成片审查"),
                        "confirmationPoints", List.of("script", "storyboard"),
                        "executionPlan", executionPlanCompiler == null ? Map.of() : executionPlanCompiler.compile(cleanPrompt)
                );
                case SCRIPT -> Map.of(
                        "summary", "根据用户输入生成 " + duration + " 短视频剧本：" + cleanPrompt,
                        "style", style + "、电影感、分镜化",
                        "targetAudience", "需要快速理解内容价值的短视频观众",
                        "durationSeconds", durationSeconds,
                        "beats", List.of(
                                "开场：在" + scene + "建立环境，快速交代「" + subject + "」。",
                                "推进：" + subject + "引导视线到「" + product + "」的核心卖点。",
                                "高潮：用近景和动态光效展示「" + product + "」的关键交互。",
                                "收束：以品牌级定格画面和行动提示结束，形成可生成视频任务。"
                        )
                );
                case CHARACTER -> Map.of(
                        "characters", List.of(
                                Map.of("name", subject, "prompt", subject + "，自信、动作清晰，服装和姿态贴合「" + cleanPrompt + "」，在每个镜头保持同一身份。"),
                                Map.of("name", product, "prompt", product + "，外观材质、轮廓、交互亮点保持一致，作为视频里的核心视觉道具。")
                        ),
                        "consistency", "后续关键帧和视频提示词固定引用「" + subject + "」与「" + product + "」，避免角色、道具和场景漂移。"
                );
                case STORYBOARD -> Map.of(
                        "scenes", List.of(
                                Map.of("shot", "01", "duration", "2s", "content", "在" + scene + "建立场景，" + subject + "进入画面并引出「" + product + "」。"),
                                Map.of("shot", "02", "duration", "3s", "content", "镜头推近，" + subject + "演示「" + product + "」的核心交互和视觉反馈。"),
                                Map.of("shot", "03", "duration", "3s", "content", "用特写、环境反光和信息层叠展示「" + product + "」的卖点，收束到品牌级定格。")
                        ),
                        "camera", "开场轻推，中段手持跟随，高潮用产品特写和轻微环绕，结尾稳定定格"
                );
                case VISUAL -> Map.of(
                        "prompt", "cinematic " + style + " video keyframe, " + scene + ", " + subject + " presenting " + product + ", concrete product details, clean lighting, 16:9, derived from: " + cleanPrompt,
                        "thumbnailUrl", thumbnail,
                        "frames", List.of(
                                scene + "建立镜头：" + subject + "和" + product + "同时入画。",
                                "交互关键帧：" + subject + "操作" + product + "，界面和光效清晰可见。",
                                "收束关键帧：" + product + "卖点占据视觉中心，背景保持" + style + "质感。"
                        )
                );
                case AUDIO -> Map.of(
                        "prompt", style + "质感配乐，" + duration + "，开场轻节奏，中段加入产品交互提示音，结尾用短促上扬音效强化发布感；主题：" + cleanPrompt,
                        "duration", duration,
                        "mood", style + "、清晰、克制、有发布会节奏"
                );
                case REVIEW -> Map.of(
                        "checks", List.of("角色一致性：" + subject, "产品一致性：" + product, "分镜连续性：" + scene, "提示词可执行性", "音画同步"),
                        "summary", "已审查「" + cleanPrompt + "」的视频链路，角色、产品、镜头和声音都具备可执行描述。"
                );
                case EXPORT -> Map.of(
                        "summary", "已把「" + cleanPrompt + "」的剧本、角色、分镜、关键帧、视频任务与音频合成为可预览成片元数据。",
                        "duration", duration,
                        "model", "AgentScope Structured Video Runtime",
                        "assetName", subject + " - " + product + " 预览片",
                        "url", "wandou://generated-videos/" + slug(cleanPrompt) + ".mp4",
                        "thumbnailUrl", thumbnail
                );
            };
        }

        private static String cleanPrompt(String prompt) {
            if (prompt == null || prompt.isBlank()) {
                return "一个结构清晰的产品视频";
            }
            return prompt.trim().replaceAll("\\s+", " ");
        }

        private static String subjectFor(String prompt) {
            String clean = cleanPrompt(prompt);
            for (String marker : List.of("主角是", "主角为", "主角：", "围绕", "关于")) {
                int index = clean.indexOf(marker);
                if (index >= 0) {
                    String tail = clean.substring(index + marker.length()).replaceAll("[，。,.；;].*$", "").trim();
                    if (!tail.isBlank()) {
                        return trimTo(tail, 16);
                    }
                }
            }
            return trimTo(clean.replaceAll("[，。,.；;].*$", "").trim(), 16);
        }

        private static String productFor(String prompt) {
            String clean = cleanPrompt(prompt);
            for (String keyword : List.of("透明屏设备", "透明屏", "产品", "设备", "机器人", "汽车", "应用", "平台")) {
                if (clean.contains(keyword)) {
                    return keyword;
                }
            }
            return "核心产品";
        }

        private static String sceneFor(String prompt) {
            String clean = cleanPrompt(prompt);
            if (clean.contains("发布")) return "科技发布会现场";
            if (clean.contains("办公室")) return "现代办公室";
            if (clean.contains("户外")) return "户外真实环境";
            if (clean.contains("工厂")) return "智能制造空间";
            return "简洁专业的展示空间";
        }

        private static String styleFor(String prompt) {
            String clean = cleanPrompt(prompt);
            if (clean.contains("科技")) return "高端科技";
            if (clean.contains("温暖")) return "温暖纪实";
            if (clean.contains("赛博")) return "赛博未来";
            if (clean.contains("商务")) return "商务发布";
            return "现代商业";
        }

        private static String durationFor(String prompt) {
            java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("(\\d+)\\s*秒").matcher(cleanPrompt(prompt));
            if (matcher.find()) {
                return matcher.group(1) + "s";
            }
            return "8s";
        }

        private static int durationSecondsFor(String prompt) {
            java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("(\\d+)\\s*秒").matcher(cleanPrompt(prompt));
            if (matcher.find()) {
                return Integer.parseInt(matcher.group(1));
            }
            return 8;
        }

        private static String trimTo(String value, int length) {
            if (value.length() <= length) {
                return value;
            }
            return value.substring(0, length);
        }

        private static String slug(String value) {
            String normalized = cleanPrompt(value).toLowerCase()
                    .replaceAll("[^a-z0-9\\u4e00-\\u9fa5]+", "-")
                    .replaceAll("(^-+|-+$)", "");
            return normalized.isBlank() ? "wandou-preview" : trimTo(normalized, 48);
        }

        private static String previewDataUri(String subject, String product, String style) {
            String svg = """
                    <svg xmlns='http://www.w3.org/2000/svg' width='900' height='506' viewBox='0 0 900 506'>
                      <defs>
                        <linearGradient id='bg' x1='0' x2='1' y1='0' y2='1'>
                          <stop offset='0' stop-color='#071b18'/>
                          <stop offset='1' stop-color='#111827'/>
                        </linearGradient>
                      </defs>
                      <rect width='900' height='506' fill='url(#bg)'/>
                      <rect x='70' y='72' width='760' height='362' rx='34' fill='#0f172a' stroke='#10b981' stroke-opacity='.55'/>
                      <text x='100' y='150' fill='#a7f3d0' font-family='Arial, sans-serif' font-size='34' font-weight='700'>%s</text>
                      <text x='100' y='210' fill='#e5e7eb' font-family='Arial, sans-serif' font-size='54' font-weight='800'>%s</text>
                      <text x='100' y='286' fill='#cbd5e1' font-family='Arial, sans-serif' font-size='38'>%s</text>
                      <rect x='100' y='330' width='420' height='18' rx='9' fill='#10b981' fill-opacity='.75'/>
                      <rect x='100' y='366' width='560' height='12' rx='6' fill='#94a3b8' fill-opacity='.45'/>
                    </svg>
                    """.formatted(escapeXml(style), escapeXml(subject), escapeXml(product));
            return "data:image/svg+xml;charset=UTF-8," + URLEncoder.encode(svg, StandardCharsets.UTF_8);
        }

        private static String escapeXml(String value) {
            return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
        }

        private record ModelStepResult(String text, Map<String, Object> output) {
        }
    }
}
