package com.wandou.ai.agent.video;

import com.wandou.ai.generation.QWaveTaskClient;
import com.wandou.ai.generation.QingyunTaskClient;
import com.wandou.ai.modelconfig.ModelConfigEntity;
import com.wandou.ai.modelconfig.ModelConfigService;
import com.wandou.ai.usage.ModelUsageContext;
import com.wandou.ai.usage.ModelUsageService;
import jakarta.annotation.PreDestroy;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
@ConditionalOnProperty(name = "wandou.ai.video.provider", havingValue = "configured")
public class ConfiguredVideoGenerationProvider implements VideoGenerationProvider {

    private final ModelConfigService modelConfigService;
    private final QWaveTaskClient qWaveTaskClient;
    private final QingyunTaskClient qingyunTaskClient;
    private final ModelUsageService modelUsageService;
    private final Map<String, VideoGenerationStatus> jobs = new ConcurrentHashMap<>();
    private final ExecutorService executorService = Executors.newFixedThreadPool(2);

    public ConfiguredVideoGenerationProvider(ModelConfigService modelConfigService, QWaveTaskClient qWaveTaskClient, QingyunTaskClient qingyunTaskClient, ModelUsageService modelUsageService) {
        this.modelConfigService = modelConfigService;
        this.qWaveTaskClient = qWaveTaskClient;
        this.qingyunTaskClient = qingyunTaskClient;
        this.modelUsageService = modelUsageService;
    }

    @Override
    public String submit(VideoGenerationRequest request) {
        ModelConfigEntity config = modelConfigService.findEnabledConfig(request.userId(), "video", request.modelConfigId())
                .filter(item -> item.apiKeySecret() != null && !item.apiKeySecret().isBlank())
                .orElseThrow(() -> new IllegalStateException("未配置可用的视频模型，请先在模型配置里启用 video 模型。"));
        Instant startedAt = Instant.now();
        ModelUsageContext usageContext = new ModelUsageContext(request.runId(), request.projectId(), request.canvasId(), request.nodeId(), "video.submit");
        modelUsageService.ensureSufficientCredits(request.userId(), config.capability(), 1);
        try {
            String taskId;
            if ("qingyun-task".equals(config.compatibilityMode())) {
                taskId = submitQingyunTask(config, request);
            } else if ("qwave-task".equals(config.compatibilityMode())) {
                taskId = submitQWaveTask(config, request);
            } else {
                throw new IllegalStateException("视频模型暂只支持 qingyun-task 或 qwave-task 兼容模式。");
            }
            modelUsageService.record(request.userId(), config, usageContext, startedAt, "success", null, taskId, 1, length(request.prompt()), 0);
            return taskId;
        } catch (RuntimeException ex) {
            modelUsageService.record(request.userId(), config, usageContext, startedAt, "failed", ex.getMessage(), null, 1, length(request.prompt()), 0);
            throw ex;
        }
    }

    private String submitQWaveTask(ModelConfigEntity config, VideoGenerationRequest request) {
        String taskId = qWaveTaskClient.submitTask(config, Map.of(
                "model", config.modelName(),
                "prompt", request.prompt(),
                "duration", durationSeconds(request.duration()),
                "aspect_ratio", normalizedAspectRatio(request.aspectRatio()),
                "resolution", normalizedResolution(request.resolution())
        ));
        jobs.put(taskId, running(taskId, "视频任务已提交，等待 provider 生成"));
        executorService.submit(() -> completeQWaveTask(config, taskId));
        return taskId;
    }

    private void completeQWaveTask(ModelConfigEntity config, String taskId) {
        try {
            QWaveTaskClient.TaskResult task = qWaveTaskClient.waitFor(config, taskId);
            jobs.put(taskId, completedQWaveStatus(task));
        } catch (RuntimeException ex) {
            jobs.put(taskId, failed(taskId, ex));
        }
    }

    private VideoGenerationStatus completedQWaveStatus(QWaveTaskClient.TaskResult task) {
        String videoUrl = task.urls().stream()
                .filter(item -> item.matches("(?i).+\\.(mp4|mov|webm)(\\?.*)?$"))
                .findFirst()
                .orElseGet(() -> task.urls().isEmpty() ? "" : task.urls().get(0));
        if (videoUrl.isBlank()) {
            throw new IllegalStateException("视频任务完成但未返回视频 URL。");
        }
        QWaveTaskClient.DownloadedMedia video = qWaveTaskClient.download(videoUrl, "video/mp4");
        byte[] thumbnailBytes = null;
        String thumbnailContentType = null;
        String thumbnailUrl = task.urls().stream()
                .filter(item -> item.matches("(?i).+\\.(png|jpg|jpeg|webp)(\\?.*)?$"))
                .findFirst()
                .orElse("");
        if (!thumbnailUrl.isBlank()) {
            QWaveTaskClient.DownloadedMedia thumbnail = qWaveTaskClient.download(thumbnailUrl, "image/png");
            thumbnailBytes = thumbnail.bytes();
            thumbnailContentType = thumbnail.contentType();
        }
        VideoGenerationStatus status = new VideoGenerationStatus(
                task.taskId(),
                "succeeded",
                100,
                "视频生成完成",
                video.bytes(),
                video.contentType(),
                thumbnailBytes,
                thumbnailContentType,
                null
        );
        return status;
    }

    private String submitQingyunTask(ModelConfigEntity config, VideoGenerationRequest request) {
        String taskId = qingyunTaskClient.submitTask(config, "/ent/v2/text2video", Map.of(
                "model", config.modelName(),
                "prompt", request.prompt(),
                "duration", qingyunDurationSeconds(request.duration()),
                "resolution", normalizedResolution(request.resolution()),
                "aspect_ratio", normalizedAspectRatio(request.aspectRatio()),
                "audio", request.audioEnabled() == null || request.audioEnabled(),
                "multi_camera", Boolean.TRUE.equals(request.multiCameraEnabled()),
                "watermark", false
        ));
        jobs.put(taskId, running(taskId, "青云/Vidu 视频任务已提交，等待生成"));
        executorService.submit(() -> completeQingyunTask(config, taskId));
        return taskId;
    }

    private void completeQingyunTask(ModelConfigEntity config, String taskId) {
        try {
            QingyunTaskClient.TaskResult task = qingyunTaskClient.waitFor(config, taskId);
            jobs.put(taskId, completedQingyunStatus(task));
        } catch (RuntimeException ex) {
            jobs.put(taskId, failed(taskId, ex));
        }
    }

    private VideoGenerationStatus completedQingyunStatus(QingyunTaskClient.TaskResult task) {
        String videoUrl = task.urls().stream()
                .filter(item -> item.matches("(?i).+\\.(mp4|mov|webm)(\\?.*)?$"))
                .findFirst()
                .orElseGet(() -> task.urls().isEmpty() ? "" : task.urls().get(0));
        if (videoUrl.isBlank()) {
            throw new IllegalStateException("青云视频任务完成但未返回视频 URL。");
        }
        QingyunTaskClient.DownloadedMedia video = qingyunTaskClient.download(videoUrl, "video/mp4");
        byte[] thumbnailBytes = null;
        String thumbnailContentType = null;
        String thumbnailUrl = task.urls().stream()
                .filter(item -> item.matches("(?i).+\\.(png|jpg|jpeg|webp)(\\?.*)?$"))
                .findFirst()
                .orElse("");
        if (!thumbnailUrl.isBlank()) {
            QingyunTaskClient.DownloadedMedia thumbnail = qingyunTaskClient.download(thumbnailUrl, "image/png");
            thumbnailBytes = thumbnail.bytes();
            thumbnailContentType = thumbnail.contentType();
        }
        VideoGenerationStatus status = new VideoGenerationStatus(
                task.taskId(),
                "succeeded",
                100,
                "视频生成完成",
                video.bytes(),
                video.contentType(),
                thumbnailBytes,
                thumbnailContentType,
                null
        );
        return status;
    }

    @Override
    public VideoGenerationStatus getStatus(String providerJobId) {
        return jobs.getOrDefault(
                providerJobId,
                new VideoGenerationStatus(providerJobId, "failed", 100, "视频任务不存在", null, null, null, null, "provider job not found")
        );
    }

    private VideoGenerationStatus running(String providerJobId, String message) {
        return new VideoGenerationStatus(providerJobId, "running", 10, message, null, null, null, null, null);
    }

    private VideoGenerationStatus failed(String providerJobId, RuntimeException ex) {
        String message = ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
        return new VideoGenerationStatus(providerJobId, "failed", 100, message, null, null, null, null, message);
    }

    private int durationSeconds(String duration) {
        if (duration == null || duration.isBlank()) {
            return 8;
        }
        String digits = duration.replaceAll("[^0-9]", "");
        return digits.isBlank() ? 8 : Integer.parseInt(digits);
    }

    private int qingyunDurationSeconds(String duration) {
        return durationSeconds(duration) <= 5 ? 5 : 10;
    }

    private String normalizedAspectRatio(String aspectRatio) {
        if (aspectRatio == null || aspectRatio.isBlank()) {
            return "16:9";
        }
        return switch (aspectRatio.trim()) {
            case "16:9", "4:3", "1:1", "3:4", "9:16" -> aspectRatio.trim();
            default -> "16:9";
        };
    }

    private String normalizedResolution(String resolution) {
        if (resolution == null || resolution.isBlank()) {
            return "720p";
        }
        return "1080p".equalsIgnoreCase(resolution.trim()) ? "1080p" : "720p";
    }

    private int length(String value) {
        return value == null ? 0 : value.length();
    }

    @PreDestroy
    public void destroy() {
        executorService.shutdownNow();
    }
}
