package com.wandou.ai.project;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "projects")
public class ProjectEntity {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column
    private String description;

    @Column(name = "aspect_ratio", nullable = false)
    private String aspectRatio;

    @Column(name = "canvas_id", nullable = false)
    private String canvasId;

    @Column(name = "conversation_id", nullable = false)
    private String conversationId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ProjectEntity() {
    }

    public ProjectEntity(String id, String name, String description, String aspectRatio, String canvasId, String conversationId, Instant createdAt) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.aspectRatio = aspectRatio;
        this.canvasId = canvasId;
        this.conversationId = conversationId;
        this.createdAt = createdAt;
    }

    public String id() { return id; }
    public String name() { return name; }
    public String description() { return description; }
    public String aspectRatio() { return aspectRatio; }
    public String canvasId() { return canvasId; }
    public String conversationId() { return conversationId; }
    public Instant createdAt() { return createdAt; }

    public void rename(String name) {
        this.name = name;
    }
}
