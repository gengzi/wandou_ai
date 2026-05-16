package com.wandou.ai.canvas;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CanvasEdgeRepository extends JpaRepository<CanvasEdgeEntity, String> {
    List<CanvasEdgeEntity> findByCanvasIdOrderByCreatedAtAsc(String canvasId);

    Optional<CanvasEdgeEntity> findByCanvasIdAndSourceNodeIdAndTargetNodeId(String canvasId, String sourceNodeId, String targetNodeId);
}
