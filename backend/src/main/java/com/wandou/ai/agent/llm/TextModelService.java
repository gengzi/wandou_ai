package com.wandou.ai.agent.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wandou.ai.modelconfig.ModelConfigEntity;
import com.wandou.ai.modelconfig.ModelConfigService;
import org.springframework.http.MediaType;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class TextModelService {

    private final ModelConfigService modelConfigService;
    private final ObjectMapper objectMapper;
    private final RestClient.Builder restClientBuilder;

    public TextModelService(ModelConfigService modelConfigService, ObjectMapper objectMapper, RestClient.Builder restClientBuilder) {
        this.modelConfigService = modelConfigService;
        this.objectMapper = objectMapper;
        this.restClientBuilder = restClientBuilder;
    }

    public Optional<TextModelCompletion> generate(String userId, String agentName, String systemPrompt, String userPrompt) {
        Optional<ModelConfigEntity> maybeConfig = modelConfigService.findEnabledConfig(userId, "text");
        if (maybeConfig.isEmpty()) {
            return Optional.empty();
        }
        ModelConfigEntity config = maybeConfig.get();
        String apiKey = config.apiKeySecret();
        if (apiKey == null || apiKey.isBlank()) {
            return Optional.empty();
        }

        Map<String, Object> request = Map.of(
                "model", config.modelName(),
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", userPrompt)
                ),
                "temperature", 0.6
        );
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
        return Optional.of(new TextModelCompletion(
                content,
                config.provider(),
                config.modelName(),
                config.displayName()
        ));
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

    private String normalizeBaseUrl(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            return "https://api.openai.com";
        }
        return baseUrl.replaceAll("/+$", "");
    }
}
