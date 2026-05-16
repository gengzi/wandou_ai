package com.wandou.ai.usage;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "model_usage_records")
public class ModelUsageRecord {
    @Id
    private String id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "run_id")
    private String runId;

    @Column(name = "project_id")
    private String projectId;

    @Column(name = "canvas_id")
    private String canvasId;

    @Column(name = "node_id")
    private String nodeId;

    @Column(nullable = false)
    private String capability;

    @Column(nullable = false)
    private String provider;

    @Column(name = "model_name", nullable = false)
    private String modelName;

    @Column(name = "model_display_name")
    private String modelDisplayName;

    @Column(name = "compatibility_mode")
    private String compatibilityMode;

    @Column(nullable = false)
    private String endpoint;

    @Column(name = "request_count", nullable = false)
    private int requestCount;

    @Column(name = "input_chars", nullable = false)
    private int inputChars;

    @Column(name = "output_chars", nullable = false)
    private int outputChars;

    @Column(nullable = false)
    private int credits;

    @Column(nullable = false)
    private String status;

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "provider_request_id")
    private String providerRequestId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    @Column(name = "duration_ms", nullable = false)
    private long durationMs;

    protected ModelUsageRecord() {
    }

    public ModelUsageRecord(String id, String userId, String runId, String projectId, String canvasId, String nodeId, String capability, String provider, String modelName, String modelDisplayName, String compatibilityMode, String endpoint, int requestCount, int inputChars, int outputChars, int credits, String status, String errorMessage, String providerRequestId, Instant createdAt, Instant completedAt, long durationMs) {
        this.id = id;
        this.userId = userId;
        this.runId = runId;
        this.projectId = projectId;
        this.canvasId = canvasId;
        this.nodeId = nodeId;
        this.capability = capability;
        this.provider = provider;
        this.modelName = modelName;
        this.modelDisplayName = modelDisplayName;
        this.compatibilityMode = compatibilityMode;
        this.endpoint = endpoint;
        this.requestCount = requestCount;
        this.inputChars = inputChars;
        this.outputChars = outputChars;
        this.credits = credits;
        this.status = status;
        this.errorMessage = errorMessage;
        this.providerRequestId = providerRequestId;
        this.createdAt = createdAt;
        this.completedAt = completedAt;
        this.durationMs = durationMs;
    }

    public String id() { return id; }
    public String userId() { return userId; }
    public String runId() { return runId; }
    public String projectId() { return projectId; }
    public String canvasId() { return canvasId; }
    public String nodeId() { return nodeId; }
    public String capability() { return capability; }
    public String provider() { return provider; }
    public String modelName() { return modelName; }
    public String modelDisplayName() { return modelDisplayName; }
    public String compatibilityMode() { return compatibilityMode; }
    public String endpoint() { return endpoint; }
    public int requestCount() { return requestCount; }
    public int inputChars() { return inputChars; }
    public int outputChars() { return outputChars; }
    public int credits() { return credits; }
    public String status() { return status; }
    public String errorMessage() { return errorMessage; }
    public String providerRequestId() { return providerRequestId; }
    public Instant createdAt() { return createdAt; }
    public Instant completedAt() { return completedAt; }
    public long durationMs() { return durationMs; }
}
