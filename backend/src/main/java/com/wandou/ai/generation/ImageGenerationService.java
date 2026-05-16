package com.wandou.ai.generation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wandou.ai.modelconfig.ModelConfigEntity;
import com.wandou.ai.modelconfig.ModelConfigService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Base64;
import java.util.Map;

@Service
public class ImageGenerationService {

    private final ModelConfigService modelConfigService;
    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;
    private final QWaveTaskClient qWaveTaskClient;
    private final QingyunTaskClient qingyunTaskClient;

    public ImageGenerationService(ModelConfigService modelConfigService, RestClient.Builder restClientBuilder, ObjectMapper objectMapper, QWaveTaskClient qWaveTaskClient, QingyunTaskClient qingyunTaskClient) {
        this.modelConfigService = modelConfigService;
        this.restClientBuilder = restClientBuilder;
        this.objectMapper = objectMapper;
        this.qWaveTaskClient = qWaveTaskClient;
        this.qingyunTaskClient = qingyunTaskClient;
    }

    public ImageResult generate(String userId, String prompt) {
        ModelConfigEntity config = modelConfigService.findEnabledConfig(userId, "image")
                .filter(item -> item.apiKeySecret() != null && !item.apiKeySecret().isBlank())
                .orElseThrow(() -> new IllegalStateException("未配置可用的真实生图模型，请先在模型配置里启用 image 模型。"));
        if (normalizeBaseUrl(config.baseUrl()).startsWith("mock://")) {
            return new ImageResult(
                    "",
                    Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGOSHzRgAAAAABJRU5ErkJggg=="),
                    "image/png",
                    "png",
                    Map.of(
                            "modelSource", "configured-image-model",
                            "modelProvider", config.provider(),
                            "modelName", config.modelName(),
                            "modelDisplayName", config.displayName()
                    )
            );
        }
        if ("qwave-task".equals(config.compatibilityMode())) {
            return generateWithQWaveTask(config, prompt);
        }
        if ("qingyun-task".equals(config.compatibilityMode())) {
            return generateWithQingyunTask(config, prompt);
        }
        try {
            String response = restClientBuilder.clone()
                    .baseUrl(normalizeBaseUrl(config.baseUrl()))
                    .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + config.apiKeySecret())
                    .build()
                    .post()
                    .uri("/v1/images/generations")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "model", config.modelName(),
                            "prompt", prompt,
                            "size", "1024x1024",
                            "n", 1
                    ))
                    .retrieve()
                    .body(String.class);
            JsonNode first = objectMapper.readTree(response).path("data").path(0);
            String url = first.path("url").asText("");
            String b64 = first.path("b64_json").asText("");
            Map<String, Object> metadata = Map.of(
                    "modelSource", "configured-image-model",
                    "modelProvider", config.provider(),
                    "modelName", config.modelName(),
                    "modelDisplayName", config.displayName()
            );
            if (!url.isBlank()) {
                return new ImageResult(url, null, "", "", metadata);
            }
            if (!b64.isBlank()) {
                return new ImageResult("", Base64.getDecoder().decode(b64), "image/png", "png", metadata);
            }
            throw new IllegalStateException("生图接口未返回 data[0].url 或 data[0].b64_json。");
        } catch (Exception ex) {
            throw new IllegalStateException("真实生图模型调用失败：" + (ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage()), ex);
        }
    }

    private String normalizeBaseUrl(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            return "https://api.openai.com";
        }
        return baseUrl.replaceAll("/+$", "");
    }

    private ImageResult generateWithQWaveTask(ModelConfigEntity config, String prompt) {
        try {
            QWaveTaskClient.TaskResult task = qWaveTaskClient.submitAndWait(config, Map.of(
                    "model", config.modelName(),
                    "prompt", prompt,
                    "aspect_ratio", "16:9",
                    "n", 1
            ));
            String url = task.urls().stream()
                    .filter(item -> item.matches("(?i).+\\.(png|jpg|jpeg|webp)(\\?.*)?$"))
                    .findFirst()
                    .orElseGet(() -> task.urls().isEmpty() ? "" : task.urls().get(0));
            if (url.isBlank()) {
                throw new IllegalStateException("任务完成但未返回图片 URL。");
            }
            return new ImageResult(url, null, "", "", Map.of(
                    "modelSource", "configured-image-model",
                    "modelProvider", config.provider(),
                    "modelName", config.modelName(),
                    "modelDisplayName", config.displayName(),
                    "compatibilityMode", config.compatibilityMode(),
                    "providerJobId", task.taskId()
            ));
        } catch (Exception ex) {
            throw new IllegalStateException("任务式生图模型调用失败：" + (ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage()), ex);
        }
    }

    private ImageResult generateWithQingyunTask(ModelConfigEntity config, String prompt) {
        try {
            QingyunTaskClient.TaskResult task = qingyunTaskClient.generateImage(config, prompt);
            String url = task.urls().stream()
                    .filter(item -> item.matches("(?i).+\\.(png|jpg|jpeg|webp)(\\?.*)?$"))
                    .findFirst()
                    .orElseGet(() -> task.urls().isEmpty() ? "" : task.urls().get(0));
            if (url.isBlank()) {
                throw new IllegalStateException("青云图片任务完成但未返回图片 URL。");
            }
            return new ImageResult(url, null, "", "", Map.of(
                    "modelSource", "configured-image-model",
                    "modelProvider", config.provider(),
                    "modelName", config.modelName(),
                    "modelDisplayName", config.displayName(),
                    "compatibilityMode", config.compatibilityMode(),
                    "providerJobId", task.taskId()
            ));
        } catch (Exception ex) {
            throw new IllegalStateException("青云任务式生图模型调用失败：" + (ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage()), ex);
        }
    }

    public record ImageResult(
            String url,
            byte[] bytes,
            String contentType,
            String extension,
            Map<String, Object> metadata
    ) {
    }
}
