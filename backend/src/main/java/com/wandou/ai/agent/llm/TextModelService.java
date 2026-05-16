package com.wandou.ai.agent.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wandou.ai.modelconfig.ModelConfigEntity;
import com.wandou.ai.modelconfig.ModelConfigService;
import com.wandou.ai.usage.ModelUsageContext;
import com.wandou.ai.usage.ModelUsageService;
import org.springframework.http.MediaType;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class TextModelService {

    private final ModelConfigService modelConfigService;
    private final ModelUsageService modelUsageService;
    private final ObjectMapper objectMapper;
    private final RestClient.Builder restClientBuilder;

    public TextModelService(ModelConfigService modelConfigService, ModelUsageService modelUsageService, ObjectMapper objectMapper, RestClient.Builder restClientBuilder) {
        this.modelConfigService = modelConfigService;
        this.modelUsageService = modelUsageService;
        this.objectMapper = objectMapper;
        this.restClientBuilder = restClientBuilder;
    }

    public Optional<TextModelCompletion> generate(String userId, String agentName, String systemPrompt, String userPrompt) {
        return generate(userId, agentName, systemPrompt, userPrompt, ModelUsageContext.endpoint("chat.completions"));
    }

    public Optional<TextModelCompletion> generate(String userId, String agentName, String systemPrompt, String userPrompt, ModelUsageContext usageContext) {
        Optional<ModelConfigEntity> maybeConfig = modelConfigService.findEnabledConfig(userId, "text");
        if (maybeConfig.isEmpty()) {
            return Optional.empty();
        }
        ModelConfigEntity config = maybeConfig.get();
        String apiKey = config.apiKeySecret();
        if (apiKey == null || apiKey.isBlank()) {
            return Optional.empty();
        }
        Instant startedAt = Instant.now();
        int inputChars = length(systemPrompt) + length(userPrompt);
        modelUsageService.ensureSufficientCredits(userId, config.capability(), 1);
        if (normalizeBaseUrl(config.baseUrl()).startsWith("mock://")) {
            String content = mockContent(agentName);
            modelUsageService.record(userId, config, usageContext, startedAt, "success", null, "mock", 1, inputChars, length(content));
            return Optional.of(new TextModelCompletion(
                    content,
                    config.provider(),
                    config.modelName(),
                    config.displayName()
            ));
        }

        Map<String, Object> request = Map.of(
                "model", config.modelName(),
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", userPrompt)
                ),
                "temperature", 0.6
        );
        try {
            String response = restClientBuilder.clone()
                    .baseUrl(normalizeBaseUrl(config.baseUrl()))
                    .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .build()
                    .post()
                    .uri("/v1/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(String.class);

            String content = extractContent(response);
            if (content.isBlank()) {
                throw new IllegalStateException("text model returned empty content");
            }
            modelUsageService.record(userId, config, usageContext, startedAt, "success", null, requestId(response), 1, inputChars, length(content));
            return Optional.of(new TextModelCompletion(
                    content,
                    config.provider(),
                    config.modelName(),
                    config.displayName()
            ));
        } catch (RuntimeException ex) {
            modelUsageService.record(userId, config, usageContext, startedAt, "failed", ex.getMessage(), null, 1, inputChars, 0);
            throw ex;
        }
    }

    private String extractContent(String response) {
        if (response == null || response.isBlank()) {
            return "";
        }
        try {
            JsonNode root = objectMapper.readTree(response);
            return root.path("choices").path(0).path("message").path("content").asText("");
        } catch (Exception ex) {
            throw new IllegalStateException("failed to parse text model response", ex);
        }
    }

    private String requestId(String response) {
        if (response == null || response.isBlank()) {
            return null;
        }
        try {
            String id = objectMapper.readTree(response).path("id").asText("");
            return id.isBlank() ? null : id;
        } catch (Exception ignored) {
            return null;
        }
    }

    private int length(String value) {
        return value == null ? 0 : value.length();
    }

    private String normalizeBaseUrl(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            return "https://api.openai.com";
        }
        return baseUrl.replaceAll("/+$", "");
    }

    private String mockContent(String agentName) {
        if (agentName == null) {
            return "{\"summary\":\"测试输出\"}";
        }
        if (agentName.contains("导演")) {
            return "{\"goal\":\"测试视频\",\"subject\":\"测试主体\",\"plan\":[\"剧本\",\"分镜\",\"视频\"],\"confirmationPoints\":[\"script\",\"storyboard\"]}";
        }
        if (agentName.contains("剧本")) {
            return "{\"summary\":\"测试短视频剧本\",\"style\":\"测试风格\",\"beats\":[\"开场\",\"推进\",\"高潮\",\"收束\"],\"targetAudience\":\"测试观众\",\"durationSeconds\":8}";
        }
        if (agentName.contains("角色")) {
            return "{\"characters\":[{\"name\":\"主角\",\"prompt\":\"测试主角提示词\"}],\"consistency\":\"保持主角一致\"}";
        }
        if (agentName.contains("分镜")) {
            return "{\"scenes\":[{\"shot\":\"01\",\"duration\":\"2s\",\"content\":\"测试镜头\"}],\"camera\":\"稳定推镜\"}";
        }
        if (agentName.contains("关键帧")) {
            return "{\"prompt\":\"cinematic test keyframe\",\"frames\":[\"测试关键帧\"]}";
        }
        if (agentName.contains("声音")) {
            return "{\"prompt\":\"测试配乐和音效\",\"duration\":\"8s\",\"mood\":\"平稳\"}";
        }
        if (agentName.contains("质量")) {
            return "{\"checks\":[\"测试检查\"],\"summary\":\"测试审查通过\"}";
        }
        if (agentName.contains("成片")) {
            return "{\"summary\":\"测试成片\",\"duration\":\"8s\",\"model\":\"mock-video\",\"assetName\":\"测试视频\"}";
        }
        return "{\"summary\":\"测试输出\"}";
    }
}
