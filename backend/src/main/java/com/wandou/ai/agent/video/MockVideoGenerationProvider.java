package com.wandou.ai.agent.video;

import com.wandou.ai.common.IdGenerator;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@ConditionalOnProperty(name = "wandou.ai.video.provider", havingValue = "mock", matchIfMissing = true)
public class MockVideoGenerationProvider implements VideoGenerationProvider {

    private static final byte[] THUMBNAIL_BYTES = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGOSHzRgAAAAABJRU5ErkJggg=="
    );
    private static final byte[] VIDEO_BYTES = Base64.getDecoder().decode(
            "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"
    );

    private final Map<String, MockJob> jobs = new ConcurrentHashMap<>();

    @Override
    public String submit(VideoGenerationRequest request) {
        String jobId = IdGenerator.id("mock_video_job_");
        boolean shouldFail = containsFailureMarker(request.prompt()) || containsFailureMarker(request.keyframePrompt());
        jobs.put(jobId, new MockJob(jobId, request, shouldFail, Instant.now()));
        return jobId;
    }

    @Override
    public VideoGenerationStatus getStatus(String providerJobId) {
        MockJob job = jobs.get(providerJobId);
        if (job == null) {
            return new VideoGenerationStatus(providerJobId, "failed", 100, "视频任务不存在", null, null, null, null, "provider job not found");
        }

        long elapsed = Duration.between(job.createdAt(), Instant.now()).toMillis();
        if (job.shouldFail() && elapsed >= 500) {
            return new VideoGenerationStatus(providerJobId, "failed", 100, "Mock 视频生成失败", null, null, null, null, "mock video generation failed");
        }
        if (elapsed < 150) {
            return running(job, "queued", 8, "视频生成任务已排队");
        }
        if (elapsed < 350) {
            return running(job, "running", 35, "正在生成镜头运动和画面连贯性");
        }
        if (elapsed < 650) {
            return running(job, "running", 72, "正在合成视频预览文件");
        }
        return new VideoGenerationStatus(
                providerJobId,
                "succeeded",
                100,
                "视频生成完成",
                VIDEO_BYTES,
                "video/mp4",
                THUMBNAIL_BYTES,
                "image/png",
                null
        );
    }

    private VideoGenerationStatus running(MockJob job, String status, int progress, String message) {
        return new VideoGenerationStatus(job.jobId(), status, progress, message, null, null, null, null, null);
    }

    private boolean containsFailureMarker(String value) {
        return value != null && (value.contains("__fail_video__") || value.contains("模拟失败"));
    }

    private record MockJob(
            String jobId,
            VideoGenerationRequest request,
            boolean shouldFail,
            Instant createdAt
    ) {
    }
}
