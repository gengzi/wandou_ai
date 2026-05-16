package com.wandou.ai.canvas;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "canvas_edges")
public class CanvasEdgeEntity {

    @Id
    private String id;

    @Column(name = "canvas_id", nullable = false)
    private String canvasId;

    @Column(name = "project_id", nullable = false)
    private String projectId;

    @Column(name = "source_node_id", nullable = false)
    private String sourceNodeId;

    @Column(name = "target_node_id", nullable = false)
    private String targetNodeId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected CanvasEdgeEntity() {
    }

    public CanvasEdgeEntity(String id, String canvasId, String projectId, String sourceNodeId, String targetNodeId, Instant createdAt) {
        this.id = id;
        this.canvasId = canvasId;
        this.projectId = projectId;
        this.sourceNodeId = sourceNodeId;
        this.targetNodeId = targetNodeId;
        this.createdAt = createdAt;
    }

    public String id() { return id; }
    public String canvasId() { return canvasId; }
    public String projectId() { return projectId; }
    public String sourceNodeId() { return sourceNodeId; }
    public String targetNodeId() { return targetNodeId; }
    public Instant createdAt() { return createdAt; }
}
