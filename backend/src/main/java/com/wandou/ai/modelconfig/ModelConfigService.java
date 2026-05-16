package com.wandou.ai.modelconfig;

import com.wandou.ai.common.IdGenerator;
import com.wandou.ai.modelconfig.dto.ModelConfigRequest;
import com.wandou.ai.modelconfig.dto.ModelConfigResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class ModelConfigService {

    private final ModelConfigRepository repository;

    public ModelConfigService(ModelConfigRepository repository) {
        this.repository = repository;
    }

    public List<ModelConfigResponse> list(String userId) {
        return repository.findByUserIdOrderByCapabilityAscUpdatedAtDesc(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Optional<ModelConfigEntity> findEnabledConfig(String userId, String capability) {
        return findEnabledConfig(userId, capability, null);
    }

    @Transactional(readOnly = true)
    public Optional<ModelConfigEntity> findEnabledConfig(String userId, String capability, String modelConfigId) {
        if (userId == null || userId.isBlank() || capability == null || capability.isBlank()) {
            return Optional.empty();
        }
        if (modelConfigId != null && !modelConfigId.isBlank()) {
            return repository.findByIdAndUserId(modelConfigId.trim(), userId)
                    .filter(ModelConfigEntity::enabled)
                    .filter(config -> capability.equals(config.capability()));
        }
        return repository.findFirstByUserIdAndCapabilityAndEnabledTrueOrderByUpdatedAtDesc(userId, capability);
    }

    @Transactional
    public ModelConfigResponse create(String userId, ModelConfigRequest request) {
        Instant now = Instant.now();
        ModelConfigEntity entity = new ModelConfigEntity(
                IdGenerator.id("model_cfg_"),
                userId,
                request.capability(),
                normalizeProvider(request.provider()),
                request.displayName(),
                request.baseUrl(),
                request.modelName(),
                normalizeCompatibilityMode(request.compatibilityMode()),
                blankToNull(request.apiKey()),
                request.enabled() == null || request.enabled(),
                now,
                now
        );
        return toResponse(repository.save(entity));
    }

    @Transactional
    public ModelConfigResponse update(String userId, String id, ModelConfigRequest request) {
        ModelConfigEntity entity = repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("model config not found"));
        entity.update(
                request.capability(),
                normalizeProvider(request.provider()),
                request.displayName(),
                request.baseUrl(),
                request.modelName(),
                normalizeCompatibilityMode(request.compatibilityMode()),
                blankToNull(request.apiKey()),
                request.enabled() == null || request.enabled(),
                Instant.now()
        );
        return toResponse(entity);
    }

    @Transactional
    public void delete(String userId, String id) {
        ModelConfigEntity entity = repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new IllegalArgumentException("model config not found"));
        repository.delete(entity);
    }

    private ModelConfigResponse toResponse(ModelConfigEntity entity) {
        return new ModelConfigResponse(
                entity.id(),
                entity.capability(),
                entity.provider(),
                entity.displayName(),
                entity.baseUrl(),
                entity.modelName(),
                entity.compatibilityMode(),
                preview(entity.apiKeySecret()),
                entity.enabled(),
                entity.createdAt(),
                entity.updatedAt()
        );
    }

    private String preview(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) {
            return "";
        }
        if (apiKey.length() <= 8) {
            return "••••";
        }
        return apiKey.substring(0, 3) + "••••" + apiKey.substring(apiKey.length() - 4);
    }

    private String normalizeProvider(String provider) {
        return provider == null || provider.isBlank() ? "openai-compatible" : provider.trim();
    }

    private String normalizeCompatibilityMode(String compatibilityMode) {
        return compatibilityMode == null || compatibilityMode.isBlank() ? "openai" : compatibilityMode.trim();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
