package com.wandou.ai.generation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wandou.ai.modelconfig.ModelConfigEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class QingyunTaskClient {

    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;

    public QingyunTaskClient(RestClient.Builder restClientBuilder, ObjectMapper objectMapper) {
        this.restClientBuilder = restClientBuilder;
        this.objectMapper = objectMapper;
    }

    public TaskResult generateImage(ModelConfigEntity config, String prompt) {
        return generateImage(config, prompt, List.of());
    }

    public TaskResult generateImage(ModelConfigEntity config, String prompt, List<String> referenceImageUrls) {
        return submitAndWait(config, "/ent/v2/reference2image", Map.of(
                "model", config.modelName(),
                "prompt", prompt,
                "images", referenceImageUrls == null ? List.of() : referenceImageUrls,
                "aspect_ratio", "16:9",
                "resolution", "1080p"
        ));
    }

    public TaskResult generateVideo(ModelConfigEntity config, String prompt, int durationSeconds) {
        return submitAndWait(config, "/ent/v2/text2video", Map.of(
                "model", config.modelName(),
                "prompt", prompt,
                "duration", normalizeDuration(durationSeconds),
                "resolution", "720p",
                "aspect_ratio", "16:9",
                "audio", true,
                "watermark", false
        ));
    }

    public TaskResult submitAndWait(ModelConfigEntity config, String path, Map<String, Object> payload) {
        return waitFor(config, submitTask(config, path, payload));
    }

    public String submitTask(ModelConfigEntity config, String path, Map<String, Object> payload) {
        String response = client(config)
                .post()
                .uri(path)
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(String.class);
        JsonNode submit = read(response);
        String taskId = textAt(submit, "task_id", "id", "data.task_id", "data.id");
        if (taskId.isBlank()) {
            throw new IllegalStateException("青云任务接口未返回 task_id。");
        }
        return taskId;
    }

    public TaskResult waitFor(ModelConfigEntity config, String taskId) {
        JsonNode last = null;
        for (int attempt = 0; attempt < 180; attempt++) {
            String response = client(config)
                    .get()
                    .uri("/ent/v2/tasks/{taskId}/creations", taskId)
                    .retrieve()
                    .body(String.class);
            last = read(response);
            String status = textAt(last, "status", "state", "data.status", "data.state");
            if (isSuccess(status)) {
                return new TaskResult(taskId, status, urls(last), last);
            }
            if (isFailure(status)) {
                throw new IllegalStateException("青云任务生成失败：" + errorMessage(last));
            }
            sleep(1000);
        }
        throw new IllegalStateException("青云任务生成超时：" + taskId + "，最后状态：" + (last == null ? "" : textAt(last, "status", "state", "data.status", "data.state")));
    }

    public DownloadedMedia download(String url, String fallbackContentType) {
        ResponseEntity<byte[]> response = restClientBuilder.clone()
                .build()
                .get()
                .uri(URI.create(url))
                .retrieve()
                .toEntity(byte[].class);
        String contentType = response.getHeaders().getContentType() == null
                ? fallbackContentType
                : response.getHeaders().getContentType().toString();
        return new DownloadedMedia(response.getBody() == null ? new byte[0] : response.getBody(), contentType);
    }

    private RestClient client(ModelConfigEntity config) {
        return restClientBuilder.clone()
                .baseUrl(normalizeBaseUrl(config.baseUrl()))
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + config.apiKeySecret())
                .build();
    }

    private JsonNode read(String response) {
        try {
            return objectMapper.readTree(response);
        } catch (Exception ex) {
            throw new IllegalStateException("青云任务接口响应不是合法 JSON。", ex);
        }
    }

    private List<String> urls(JsonNode node) {
        List<String> values = new ArrayList<>();
        collectUrls(node, values);
        return values.stream().distinct().toList();
    }

    private void collectUrls(JsonNode node, List<String> values) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return;
        }
        if (node.isTextual()) {
            String value = node.asText("");
            if (value.startsWith("http://") || value.startsWith("https://")) {
                values.add(value);
            }
            return;
        }
        if (node.isArray()) {
            node.forEach(item -> collectUrls(item, values));
            return;
        }
        if (node.isObject()) {
            node.fields().forEachRemaining(entry -> {
                String key = entry.getKey().toLowerCase();
                if (key.contains("url") || key.equals("image") || key.equals("video") || key.equals("file")) {
                    collectUrls(entry.getValue(), values);
                } else if (key.equals("output") || key.equals("result") || key.equals("data") || key.equals("images") || key.equals("videos") || key.equals("creations") || key.equals("files")) {
                    collectUrls(entry.getValue(), values);
                }
            });
        }
    }

    private String errorMessage(JsonNode node) {
        String message = textAt(node, "error.message", "message", "data.error.message", "data.detail", "detail", "err_msg", "err_code");
        return message.isBlank() ? node.toString() : message;
    }

    private String textAt(JsonNode node, String... paths) {
        for (String path : paths) {
            JsonNode current = node;
            for (String part : path.split("\\.")) {
                current = current.path(part);
            }
            String value = current.asText("");
            if (!value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private boolean isSuccess(String status) {
        return "success".equals(status) || "succeeded".equals(status) || "completed".equals(status) || "done".equals(status);
    }

    private boolean isFailure(String status) {
        return "failed".equals(status) || "error".equals(status) || "cancelled".equals(status) || "canceled".equals(status);
    }

    private String normalizeBaseUrl(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            return "https://api.qingyuntop.top";
        }
        return baseUrl.replaceAll("/+$", "");
    }

    private int normalizeDuration(int durationSeconds) {
        return durationSeconds <= 5 ? 5 : 10;
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("青云任务轮询被中断。", ex);
        }
    }

    public record TaskResult(String taskId, String status, List<String> urls, JsonNode raw) {
    }

    public record DownloadedMedia(byte[] bytes, String contentType) {
    }
}
