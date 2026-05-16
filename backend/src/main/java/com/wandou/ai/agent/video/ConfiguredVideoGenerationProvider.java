package com.wandou.ai.agent.video;

import com.wandou.ai.generation.QWaveTaskClient;
import com.wandou.ai.generation.QingyunTaskClient;
import com.wandou.ai.modelconfig.ModelConfigEntity;
import com.wandou.ai.modelconfig.ModelConfigService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@ConditionalOnProperty(name = "wandou.ai.video.provider", havingValue = "configured")
public class ConfiguredVideoGenerationProvider implements VideoGenerationProvider {

    private final ModelConfigService modelConfigService;
    private final QWaveTaskClient qWaveTaskClient;
    private final QingyunTaskClient qingyunTaskClient;
    private final Map<String, VideoGenerationStatus> completedJobs = new ConcurrentHashMap<>();

    public ConfiguredVideoGenerationProvider(ModelConfigService modelConfigService, QWaveTaskClient qWaveTaskClient, QingyunTaskClient qingyunTaskClient) {
        this.modelConfigService = modelConfigService;
        this.qWaveTaskClient = qWaveTaskClient;
        this.qingyunTaskClient = qingyunTaskClient;
    }

    @Override
    public String submit(VideoGenerationRequest request) {
        ModelConfigEntity config = modelConfigService.findEnabledConfig(request.userId(), "video")
                .filter(item -> item.apiKeySecret() != null && !item.apiKeySecret().isBlank())
                .orElseThrow(() -> new IllegalStateException("未配置可用的视频模型，请先在模型配置里启用 video 模型。"));
        if ("qingyun-task".equals(config.compatibilityMode())) {
            return submitQingyunTask(config, request);
        }
        if (!"qwave-task".equals(config.compatibilityMode())) {
            throw new IllegalStateException("视频模型暂只支持 qingyun-task 或 qwave-task 兼容模式。");
        }
        return submitQWaveTask(config, request);
    }

    private String submitQWaveTask(ModelConfigEntity config, VideoGenerationRequest request) {
        QWaveTaskClient.TaskResult task = qWaveTaskClient.submitAndWait(config, Map.of(
                "model", config.modelName(),
                "prompt", request.prompt(),
                "duration", durationSeconds(request.duration()),
                "aspect_ratio", "16:9",
                "resolution", "720p"
        ));
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
        completedJobs.put(task.taskId(), status);
        return task.taskId();
    }

    private String submitQingyunTask(ModelConfigEntity config, VideoGenerationRequest request) {
        QingyunTaskClient.TaskResult task = qingyunTaskClient.generateVideo(config, request.prompt(), durationSeconds(request.duration()));
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
        completedJobs.put(task.taskId(), status);
        return task.taskId();
    }

    @Override
    public VideoGenerationStatus getStatus(String providerJobId) {
        return completedJobs.getOrDefault(
                providerJobId,
                new VideoGenerationStatus(providerJobId, "failed", 100, "视频任务不存在", null, null, null, null, "provider job not found")
        );
    }

    private int durationSeconds(String duration) {
        if (duration == null || duration.isBlank()) {
            return 8;
        }
        String digits = duration.replaceAll("[^0-9]", "");
        return digits.isBlank() ? 8 : Integer.parseInt(digits);
    }
}
