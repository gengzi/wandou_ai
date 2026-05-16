package com.wandou.ai.agent.monitor;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "agent_run_monitor_snapshots")
public class AgentRunMonitorSnapshotEntity {

    @Id
    @Column(name = "run_id")
    private String runId;

    @Column(nullable = false)
    private String status;

    @Column(name = "current_step", nullable = false)
    private String currentStep;

    @Column(name = "bottleneck_step", nullable = false)
    private String bottleneckStep;

    @Column(name = "run_duration_ms", nullable = false)
    private long runDurationMs;

    @Column(name = "event_count", nullable = false)
    private int eventCount;

    @Column(name = "interruption_count", nullable = false)
    private int interruptionCount;

    @Column(name = "confirmation_wait_count", nullable = false)
    private int confirmationWaitCount;

    @Column(name = "total_confirmation_wait_ms", nullable = false)
    private long totalConfirmationWaitMs;

    @Column(name = "steps_json", nullable = false, columnDefinition = "TEXT")
    private String stepsJson;

    @Column(name = "design_signals_json", nullable = false, columnDefinition = "TEXT")
    private String designSignalsJson;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected AgentRunMonitorSnapshotEntity() {
    }

    public AgentRunMonitorSnapshotEntity(String runId, String status, String currentStep, String bottleneckStep, long runDurationMs, int eventCount, int interruptionCount, int confirmationWaitCount, long totalConfirmationWaitMs, String stepsJson, String designSignalsJson, Instant updatedAt) {
        this.runId = runId;
        this.status = status;
        this.currentStep = currentStep;
        this.bottleneckStep = bottleneckStep;
        this.runDurationMs = runDurationMs;
        this.eventCount = eventCount;
        this.interruptionCount = interruptionCount;
        this.confirmationWaitCount = confirmationWaitCount;
        this.totalConfirmationWaitMs = totalConfirmationWaitMs;
        this.stepsJson = stepsJson;
        this.designSignalsJson = designSignalsJson;
        this.updatedAt = updatedAt;
    }

    public String runId() { return runId; }
    public String status() { return status; }
    public String currentStep() { return currentStep; }
    public String bottleneckStep() { return bottleneckStep; }
    public long runDurationMs() { return runDurationMs; }
    public int eventCount() { return eventCount; }
    public int interruptionCount() { return interruptionCount; }
    public int confirmationWaitCount() { return confirmationWaitCount; }
    public long totalConfirmationWaitMs() { return totalConfirmationWaitMs; }
    public String stepsJson() { return stepsJson; }
    public String designSignalsJson() { return designSignalsJson; }
    public Instant updatedAt() { return updatedAt; }
}
