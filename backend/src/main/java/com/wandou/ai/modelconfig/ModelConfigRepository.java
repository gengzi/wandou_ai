package com.wandou.ai.modelconfig;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ModelConfigRepository extends JpaRepository<ModelConfigEntity, String> {

    List<ModelConfigEntity> findByUserIdOrderByCapabilityAscUpdatedAtDesc(String userId);

    Optional<ModelConfigEntity> findByIdAndUserId(String id, String userId);

    Optional<ModelConfigEntity> findFirstByUserIdAndCapabilityAndEnabledTrueOrderByUpdatedAtDesc(String userId, String capability);
}
