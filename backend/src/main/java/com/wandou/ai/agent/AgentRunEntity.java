package com.wandou.ai.agent;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "agent_runs")
public class AgentRunEntity {

    @Id
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "project_id", nullable = false)
    private String projectId;

    @Column(name = "conversation_id", nullable = false)
    private String conversationId;

    @Column(name = "canvas_id", nullable = false)
    private String canvasId;

    @Column(nullable = false)
    private String status;

    @Column(name = "agent_name", nullable = false)
    private String agentName;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(columnDefinition = "TEXT")
    private String error;

    @Column
    private String checkpoint;

    @Column(name = "stream_url", nullable = false)
    private String streamUrl;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected AgentRunEntity() {
    }

    public AgentRunEntity(String id, String userId, String projectId, String conversationId, String canvasId, String status, String agentName, String message, String error, String checkpoint, String streamUrl, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.userId = userId;
        this.projectId = projectId;
        this.conversationId = conversationId;
        this.canvasId = canvasId;
        this.status = status;
        this.agentName = agentName;
        this.message = message;
        this.error = error;
        this.checkpoint = checkpoint;
        this.streamUrl = streamUrl;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String id() { return id; }
    public String userId() { return userId; }
    public String projectId() { return projectId; }
    public String conversationId() { return conversationId; }
    public String canvasId() { return canvasId; }
    public String status() { return status; }
    public String agentName() { return agentName; }
    public String message() { return message; }
    public String error() { return error; }
    public String checkpoint() { return checkpoint; }
    public String streamUrl() { return streamUrl; }
    public Instant createdAt() { return createdAt; }
    public Instant updatedAt() { return updatedAt; }

    public void update(String status, String error, String checkpoint, Instant updatedAt) {
        this.status = status;
        this.error = error;
        this.checkpoint = checkpoint;
        this.updatedAt = updatedAt;
    }
}
