package com.wandou.ai.generation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wandou.ai.modelconfig.ModelConfigEntity;
import com.wandou.ai.modelconfig.ModelConfigService;
import com.wandou.ai.usage.ModelUsageContext;
import com.wandou.ai.usage.ModelUsageService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.time.Instant;

@Service
public class ImageGenerationService {

    private final ModelConfigService modelConfigService;
    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;
    private final QWaveTaskClient qWaveTaskClient;
    private final QingyunTaskClient qingyunTaskClient;
    private final ModelUsageService modelUsageService;

    public ImageGenerationService(ModelConfigService modelConfigService, RestClient.Builder restClientBuilder, ObjectMapper objectMapper, QWaveTaskClient qWaveTaskClient, QingyunTaskClient qingyunTaskClient, ModelUsageService modelUsageService) {
        this.modelConfigService = modelConfigService;
        this.restClientBuilder = restClientBuilder;
        this.objectMapper = objectMapper;
        this.qWaveTaskClient = qWaveTaskClient;
        this.qingyunTaskClient = qingyunTaskClient;
        this.modelUsageService = modelUsageService;
    }

    public ImageResult generate(String userId, String prompt) {
        return generate(userId, prompt, ModelUsageContext.endpoint("images.generations"));
    }

    public ImageResult generate(String userId, String prompt, ModelUsageContext usageContext) {
        return generate(userId, prompt, List.of(), null, usageContext);
    }

    public ImageResult generate(String userId, String prompt, String modelConfigId, ModelUsageContext usageContext) {
        return generate(userId, prompt, List.of(), modelConfigId, usageContext);
    }

    public ImageResult generate(String userId, String prompt, List<String> referenceImageUrls, ModelUsageContext usageContext) {
        return generate(userId, prompt, referenceImageUrls, null, usageContext);
    }

    public ImageResult generate(String userId, String prompt, List<String> referenceImageUrls, String modelConfigId, ModelUsageContext usageContext) {
        ModelConfigEntity config = modelConfigService.findEnabledConfig(userId, "image", modelConfigId)
                .filter(item -> !requiresApiKey(item) || (item.apiKeySecret() != null && !item.apiKeySecret().isBlank()))
                .orElseThrow(() -> new IllegalStateException("未配置可用的真实生图模型，请先在模型配置里启用 image 模型。"));
        Instant startedAt = Instant.now();
        modelUsageService.ensureSufficientCredits(userId, config.capability(), 1);
        if (normalizeBaseUrl(config.baseUrl()).startsWith("mock://")) {
            modelUsageService.record(userId, config, usageContext, startedAt, "success", null, "mock", 1, length(prompt), 0);
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
            return generateWithQWaveTask(userId, config, prompt, referenceImageUrls, usageContext, startedAt);
        }
        if ("qingyun-task".equals(config.compatibilityMode())) {
            return generateWithQingyunTask(userId, config, prompt, referenceImageUrls, usageContext, startedAt);
        }
        if ("pollinations".equals(config.compatibilityMode())) {
            return generateWithPollinations(userId, config, prompt, usageContext, startedAt);
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
                DownloadedImage image = downloadImage(url);
                modelUsageService.record(userId, config, usageContext, startedAt, "success", null, requestId(response), 1, length(prompt), 0);
                return new ImageResult("", image.bytes(), image.contentType(), extension(image.contentType(), url), metadata);
            }
            if (!b64.isBlank()) {
                modelUsageService.record(userId, config, usageContext, startedAt, "success", null, requestId(response), 1, length(prompt), b64.length());
                return new ImageResult("", Base64.getDecoder().decode(b64), "image/png", "png", metadata);
            }
            throw new IllegalStateException("生图接口未返回 data[0].url 或 data[0].b64_json。");
        } catch (Exception ex) {
            modelUsageService.record(userId, config, usageContext, startedAt, "failed", ex.getMessage(), null, 1, length(prompt), 0);
            throw new IllegalStateException("真实生图模型调用失败：" + (ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage()), ex);
        }
    }

    private String normalizeBaseUrl(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            return "https://api.openai.com";
        }
        return baseUrl.replaceAll("/+$", "");
    }

    private boolean requiresApiKey(ModelConfigEntity config) {
        return !"pollinations".equals(config.compatibilityMode())
                && !normalizeBaseUrl(config.baseUrl()).startsWith("mock://");
    }

    private ImageResult generateWithPollinations(String userId, ModelConfigEntity config, String prompt, ModelUsageContext usageContext, Instant startedAt) {
        try {
            String encodedPrompt = URLEncoder.encode(prompt == null ? "" : prompt, StandardCharsets.UTF_8);
            String model = config.modelName() == null || config.modelName().isBlank() ? "flux" : config.modelName();
            String url = normalizeBaseUrl(config.baseUrl())
                    + "/prompt/" + encodedPrompt
                    + "?width=1024&height=1024&nologo=true&private=true&model="
                    + URLEncoder.encode(model, StandardCharsets.UTF_8);
            DownloadedImage image = downloadImage(url);
            modelUsageService.record(userId, config, usageContext, startedAt, "success", null, "pollinations", 1, length(prompt), 0);
            return new ImageResult("", image.bytes(), image.contentType(), extension(image.contentType(), url), Map.of(
                    "modelSource", "configured-image-model",
                    "modelProvider", config.provider(),
                    "modelName", config.modelName(),
                    "modelDisplayName", config.displayName(),
                    "compatibilityMode", config.compatibilityMode()
            ));
        } catch (Exception ex) {
            modelUsageService.record(userId, config, usageContext, startedAt, "failed", ex.getMessage(), null, 1, length(prompt), 0);
            throw new IllegalStateException("Pollinations 免费生图调用失败：" + (ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage()), ex);
        }
    }

    private ImageResult generateWithQWaveTask(String userId, ModelConfigEntity config, String prompt, List<String> referenceImageUrls, ModelUsageContext usageContext, Instant startedAt) {
        try {
            Map<String, Object> payload = new java.util.LinkedHashMap<>();
            payload.put("model", config.modelName());
            payload.put("prompt", prompt);
            payload.put("aspect_ratio", "16:9");
            payload.put("n", 1);
            if (!referenceImageUrls.isEmpty()) {
                payload.put("images", referenceImageUrls);
            }
            QWaveTaskClient.TaskResult task = qWaveTaskClient.submitAndWait(config, payload);
            String url = task.urls().stream()
                    .filter(item -> item.matches("(?i).+\\.(png|jpg|jpeg|webp)(\\?.*)?$"))
                    .findFirst()
                    .orElseGet(() -> task.urls().isEmpty() ? "" : task.urls().get(0));
            if (url.isBlank()) {
                throw new IllegalStateException("任务完成但未返回图片 URL。");
            }
            QWaveTaskClient.DownloadedMedia image = qWaveTaskClient.download(url, "image/png");
            modelUsageService.record(userId, config, usageContext, startedAt, "success", null, task.taskId(), 1, length(prompt), 0);
            return new ImageResult("", image.bytes(), image.contentType(), extension(image.contentType(), url), Map.of(
                    "modelSource", "configured-image-model",
                    "modelProvider", config.provider(),
                    "modelName", config.modelName(),
                    "modelDisplayName", config.displayName(),
                    "compatibilityMode", config.compatibilityMode(),
                    "providerJobId", task.taskId()
            ));
        } catch (Exception ex) {
            modelUsageService.record(userId, config, usageContext, startedAt, "failed", ex.getMessage(), null, 1, length(prompt), 0);
            throw new IllegalStateException("任务式生图模型调用失败：" + (ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage()), ex);
        }
    }

    private ImageResult generateWithQingyunTask(String userId, ModelConfigEntity config, String prompt, List<String> referenceImageUrls, ModelUsageContext usageContext, Instant startedAt) {
        try {
            QingyunTaskClient.TaskResult task = qingyunTaskClient.generateImage(config, prompt, referenceImageUrls);
            String url = task.urls().stream()
                    .filter(item -> item.matches("(?i).+\\.(png|jpg|jpeg|webp)(\\?.*)?$"))
                    .findFirst()
                    .orElseGet(() -> task.urls().isEmpty() ? "" : task.urls().get(0));
            if (url.isBlank()) {
                throw new IllegalStateException("青云图片任务完成但未返回图片 URL。");
            }
            QingyunTaskClient.DownloadedMedia image = qingyunTaskClient.download(url, "image/png");
            modelUsageService.record(userId, config, usageContext, startedAt, "success", null, task.taskId(), 1, length(prompt), 0);
            return new ImageResult("", image.bytes(), image.contentType(), extension(image.contentType(), url), Map.of(
                    "modelSource", "configured-image-model",
                    "modelProvider", config.provider(),
                    "modelName", config.modelName(),
                    "modelDisplayName", config.displayName(),
                    "compatibilityMode", config.compatibilityMode(),
                    "providerJobId", task.taskId()
            ));
        } catch (Exception ex) {
            modelUsageService.record(userId, config, usageContext, startedAt, "failed", ex.getMessage(), null, 1, length(prompt), 0);
            throw new IllegalStateException("青云任务式生图模型调用失败：" + (ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage()), ex);
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

    private DownloadedImage downloadImage(String url) {
        ResponseEntity<byte[]> response = restClientBuilder.clone()
                .build()
                .get()
                .uri(URI.create(url))
                .retrieve()
                .toEntity(byte[].class);
        byte[] bytes = response.getBody() == null ? new byte[0] : response.getBody();
        if (bytes.length == 0) {
            throw new IllegalStateException("生图接口返回的图片 URL 下载结果为空。");
        }
        String contentType = response.getHeaders().getContentType() == null
                ? "image/png"
                : response.getHeaders().getContentType().toString();
        return new DownloadedImage(bytes, contentType);
    }

    private String extension(String contentType, String url) {
        String normalized = contentType == null ? "" : contentType.toLowerCase();
        if (normalized.contains("jpeg") || normalized.contains("jpg")) {
            return "jpg";
        }
        if (normalized.contains("webp")) {
            return "webp";
        }
        if (normalized.contains("gif")) {
            return "gif";
        }
        if (normalized.contains("png")) {
            return "png";
        }
        String path = URI.create(url).getPath();
        int dot = path.lastIndexOf('.');
        if (dot >= 0 && dot < path.length() - 1) {
            return path.substring(dot + 1).replaceAll("[^A-Za-z0-9]", "");
        }
        return "png";
    }

    private record DownloadedImage(byte[] bytes, String contentType) {
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
