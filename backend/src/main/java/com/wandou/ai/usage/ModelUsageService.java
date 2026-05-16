package com.wandou.ai.usage;

import com.wandou.ai.common.IdGenerator;
import com.wandou.ai.config.WandouAiProperties;
import com.wandou.ai.modelconfig.ModelConfigEntity;
import com.wandou.ai.usage.dto.ModelUsageRecordPageResponse;
import com.wandou.ai.usage.dto.ModelUsageRecordResponse;
import com.wandou.ai.usage.dto.UsageSummaryResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
public class ModelUsageService {
    private final ModelUsageRepository repository;
    private final WandouAiProperties properties;

    public ModelUsageService(ModelUsageRepository repository, WandouAiProperties properties) {
        this.repository = repository;
        this.properties = properties;
    }

    @Transactional
    public ModelUsageRecordResponse record(
            String userId,
            ModelConfigEntity config,
            ModelUsageContext context,
            Instant startedAt,
            String status,
            String errorMessage,
            String providerRequestId,
            int requestCount,
            int inputChars,
            int outputChars
    ) {
        Instant completedAt = Instant.now();
        int credits = creditsFor(config.capability(), requestCount);
        ModelUsageRecord record = repository.save(new ModelUsageRecord(
                IdGenerator.longId("usage_"),
                userId,
                context == null ? null : context.runId(),
                context == null ? null : context.projectId(),
                context == null ? null : context.canvasId(),
                context == null ? null : context.nodeId(),
                config.capability(),
                config.provider(),
                config.modelName(),
                config.displayName(),
                config.compatibilityMode(),
                context == null || context.endpoint() == null || context.endpoint().isBlank() ? defaultEndpoint(config.capability()) : context.endpoint(),
                Math.max(1, requestCount),
                Math.max(0, inputChars),
                Math.max(0, outputChars),
                credits,
                status,
                trim(errorMessage, 1000),
                providerRequestId,
                startedAt,
                completedAt,
                Duration.between(startedAt, completedAt).toMillis()
        ));
        return toResponse(record);
    }

    public void ensureSufficientCredits(String userId, String capability, int requestCount) {
        int required = creditsFor(capability, requestCount);
        long remaining = properties.getUsage().getInitialCredits() - repository.sumCreditsByUserId(userId);
        if (remaining < required) {
            throw new IllegalStateException("积分不足：本次调用需要 " + required + " 积分，当前剩余 " + Math.max(0, remaining) + "。");
        }
    }

    public UsageSummaryResponse summary(String userId) {
        int initialCredits = properties.getUsage().getInitialCredits();
        long used = repository.sumCreditsByUserId(userId);
        long requestCount = repository.countByUserId(userId);
        List<ModelUsageRecordResponse> recent = repository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, 30)).stream()
                .map(this::toResponse)
                .toList();
        return new UsageSummaryResponse(initialCredits, used, Math.max(0, initialCredits - used), requestCount, recent);
    }

    public List<ModelUsageRecordResponse> records(String userId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 100));
        return repository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, safeLimit)).stream()
                .map(this::toResponse)
                .toList();
    }

    public ModelUsageRecordPageResponse recordPage(String userId, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        Page<ModelUsageRecord> result = repository.findPageByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(safePage, safeSize));
        return new ModelUsageRecordPageResponse(
                result.getContent().stream().map(this::toResponse).toList(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.getNumber(),
                result.getSize()
        );
    }

    private int creditsFor(String capability, int requestCount) {
        WandouAiProperties.UsageCredits credits = properties.getUsage().getCredits();
        int unit = switch (capability) {
            case "image" -> credits.getImage();
            case "video" -> credits.getVideo();
            case "audio" -> credits.getAudio();
            default -> credits.getText();
        };
        return Math.max(1, requestCount) * Math.max(0, unit);
    }

    private String defaultEndpoint(String capability) {
        return switch (capability) {
            case "image" -> "images.generations";
            case "video" -> "video.generations";
            case "audio" -> "audio.generations";
            default -> "chat.completions";
        };
    }

    private ModelUsageRecordResponse toResponse(ModelUsageRecord record) {
        return new ModelUsageRecordResponse(
                record.id(),
                record.runId(),
                record.projectId(),
                record.canvasId(),
                record.nodeId(),
                record.capability(),
                record.provider(),
                record.modelName(),
                record.modelDisplayName(),
                record.compatibilityMode(),
                record.endpoint(),
                record.requestCount(),
                record.inputChars(),
                record.outputChars(),
                record.credits(),
                record.status(),
                record.errorMessage(),
                record.providerRequestId(),
                record.createdAt(),
                record.completedAt(),
                record.durationMs()
        );
    }

    private String trim(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
