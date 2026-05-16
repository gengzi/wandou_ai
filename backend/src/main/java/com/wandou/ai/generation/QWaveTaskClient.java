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
public class QWaveTaskClient {

    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;

    public QWaveTaskClient(RestClient.Builder restClientBuilder, ObjectMapper objectMapper) {
        this.restClientBuilder = restClientBuilder;
        this.objectMapper = objectMapper;
    }

    public TaskResult submitAndWait(ModelConfigEntity config, Map<String, Object> payload) {
        return waitFor(config, submitTask(config, payload));
    }

    public String submitTask(ModelConfigEntity config, Map<String, Object> payload) {
        String response = client(config)
                .post()
                .uri("/v1/tasks")
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(String.class);
        JsonNode submit = read(response);
        String taskId = textAt(submit, "task_id", "id", "data.task_id", "data.id");
        if (taskId.isBlank()) {
            throw new IllegalStateException("任务接口未返回 task_id。");
        }
        return taskId;
    }

    public TaskResult waitFor(ModelConfigEntity config, String taskId) {
        JsonNode last = null;
        for (int attempt = 0; attempt < 160; attempt++) {
            String response = client(config)
                    .get()
                    .uri("/v1/tasks/{taskId}", taskId)
                    .retrieve()
                    .body(String.class);
            last = read(response);
            String status = textAt(last, "status", "data.status");
            if (isSuccess(status)) {
                return new TaskResult(taskId, status, urls(last), last);
            }
            if (isFailure(status)) {
                throw new IllegalStateException("任务生成失败：" + errorMessage(last));
            }
            sleep(1000);
        }
        throw new IllegalStateException("任务生成超时：" + taskId + "，最后状态：" + (last == null ? "" : textAt(last, "status", "data.status")));
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
            throw new IllegalStateException("任务接口响应不是合法 JSON。", ex);
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
                } else if (key.equals("output") || key.equals("result") || key.equals("data") || key.equals("images") || key.equals("videos") || key.equals("files")) {
                    collectUrls(entry.getValue(), values);
                }
            });
        }
    }

    private String errorMessage(JsonNode node) {
        String message = textAt(node, "error.message", "error.raw_message", "message", "data.error.message", "data.detail", "detail");
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
        return "completed".equals(status) || "succeeded".equals(status) || "success".equals(status) || "done".equals(status);
    }

    private boolean isFailure(String status) {
        return "failed".equals(status) || "error".equals(status) || "cancelled".equals(status) || "canceled".equals(status);
    }

    private String normalizeBaseUrl(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            return "https://www.qingbo.dev";
        }
        return baseUrl.replaceAll("/+$", "");
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("任务轮询被中断。", ex);
        }
    }

    public record TaskResult(String taskId, String status, List<String> urls, JsonNode raw) {
    }

    public record DownloadedMedia(byte[] bytes, String contentType) {
    }
}
