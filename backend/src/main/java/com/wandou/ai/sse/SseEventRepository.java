package com.wandou.ai.sse;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SseEventRepository extends JpaRepository<SseEventEntity, String> {
    List<SseEventEntity> findTop200ByRunIdOrderByCreatedAtDesc(String runId);
}
