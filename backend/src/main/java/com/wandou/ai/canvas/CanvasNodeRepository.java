package com.wandou.ai.canvas;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CanvasNodeRepository extends JpaRepository<CanvasNodeEntity, String> {
    List<CanvasNodeEntity> findByCanvasIdOrderByCreatedAtAsc(String canvasId);

    Optional<CanvasNodeEntity> findByCanvasIdAndNodeId(String canvasId, String nodeId);
}
