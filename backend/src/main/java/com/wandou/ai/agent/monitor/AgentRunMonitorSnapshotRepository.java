package com.wandou.ai.agent.monitor;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AgentRunMonitorSnapshotRepository extends JpaRepository<AgentRunMonitorSnapshotEntity, String> {
}
