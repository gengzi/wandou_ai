package com.wandou.ai.canvas;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "canvas_nodes")
public class CanvasNodeEntity {

    @Id
    private String id;

    @Column(name = "canvas_id", nullable = false)
    private String canvasId;

    @Column(name = "project_id", nullable = false)
    private String projectId;

    @Column(name = "node_id", nullable = false)
    private String nodeId;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String status;

    @Column(name = "position_x", nullable = false)
    private double positionX;

    @Column(name = "position_y", nullable = false)
    private double positionY;

    @Column(name = "data_json", nullable = false)
    private String dataJson;

    @Column(name = "output_json", nullable = false)
    private String outputJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected CanvasNodeEntity() {
    }

    public CanvasNodeEntity(String id, String canvasId, String projectId, String nodeId, String type, String title, String status, double positionX, double positionY, String dataJson, String outputJson, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.canvasId = canvasId;
        this.projectId = projectId;
        this.nodeId = nodeId;
        this.type = type;
        this.title = title;
        this.status = status;
        this.positionX = positionX;
        this.positionY = positionY;
        this.dataJson = dataJson;
        this.outputJson = outputJson;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String id() { return id; }
    public String canvasId() { return canvasId; }
    public String projectId() { return projectId; }
    public String nodeId() { return nodeId; }
    public String type() { return type; }
    public String title() { return title; }
    public String status() { return status; }
    public double positionX() { return positionX; }
    public double positionY() { return positionY; }
    public String dataJson() { return dataJson; }
    public String outputJson() { return outputJson; }
    public Instant createdAt() { return createdAt; }
    public Instant updatedAt() { return updatedAt; }

    public void update(String status, double positionX, double positionY, String dataJson, String outputJson, Instant updatedAt) {
        this.status = status;
        this.positionX = positionX;
        this.positionY = positionY;
        this.dataJson = dataJson;
        this.outputJson = outputJson;
        this.updatedAt = updatedAt;
    }
}
