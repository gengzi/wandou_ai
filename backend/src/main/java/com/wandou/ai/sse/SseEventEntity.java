package com.wandou.ai.sse;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "agent_run_events")
public class SseEventEntity {

    @Id
    private String id;

    @Column(name = "run_id", nullable = false)
    private String runId;

    @Column(name = "event_name", nullable = false)
    private String eventName;

    @Column(name = "data_json", nullable = false, columnDefinition = "TEXT")
    private String dataJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected SseEventEntity() {
    }

    public SseEventEntity(String id, String runId, String eventName, String dataJson, Instant createdAt) {
        this.id = id;
        this.runId = runId;
        this.eventName = eventName;
        this.dataJson = dataJson;
        this.createdAt = createdAt;
    }

    public String id() { return id; }
    public String runId() { return runId; }
    public String eventName() { return eventName; }
    public String dataJson() { return dataJson; }
    public Instant createdAt() { return createdAt; }
}
