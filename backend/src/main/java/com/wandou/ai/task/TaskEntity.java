package com.wandou.ai.task;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "tasks")
public class TaskEntity {

    @Id
    private String id;

    @Column(name = "run_id", nullable = false)
    private String runId;

    @Column(name = "project_id", nullable = false)
    private String projectId;

    @Column(name = "canvas_id", nullable = false)
    private String canvasId;

    @Column(name = "node_id", nullable = false)
    private String nodeId;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private String status;

    @Column(nullable = false)
    private int progress;

    @Column(nullable = false)
    private String message;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected TaskEntity() {
    }

    public TaskEntity(String id, String runId, String projectId, String canvasId, String nodeId, String type, String status, int progress, String message, Instant updatedAt) {
        this.id = id;
        this.runId = runId;
        this.projectId = projectId;
        this.canvasId = canvasId;
        this.nodeId = nodeId;
        this.type = type;
        this.status = status;
        this.progress = progress;
        this.message = message;
        this.updatedAt = updatedAt;
    }

    public String id() {
        return id;
    }

    public String runId() {
        return runId;
    }

    public String projectId() {
        return projectId;
    }

    public String canvasId() {
        return canvasId;
    }

    public String nodeId() {
        return nodeId;
    }

    public String type() {
        return type;
    }

    public String status() {
        return status;
    }

    public int progress() {
        return progress;
    }

    public String message() {
        return message;
    }

    public Instant updatedAt() {
        return updatedAt;
    }

    public void update(String status, int progress, String message, Instant updatedAt) {
        this.status = status;
        this.progress = progress;
        this.message = message;
        this.updatedAt = updatedAt;
    }
}
