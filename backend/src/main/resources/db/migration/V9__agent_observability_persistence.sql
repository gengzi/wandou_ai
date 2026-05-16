CREATE TABLE agent_runs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    project_id VARCHAR(64) NOT NULL,
    conversation_id VARCHAR(64) NOT NULL,
    canvas_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    agent_name VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    error TEXT,
    checkpoint VARCHAR(100),
    stream_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT fk_agent_runs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE agent_run_events (
    id VARCHAR(64) PRIMARY KEY,
    run_id VARCHAR(64) NOT NULL,
    event_name VARCHAR(120) NOT NULL,
    data_json TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE agent_run_monitor_snapshots (
    run_id VARCHAR(64) PRIMARY KEY,
    status VARCHAR(32) NOT NULL,
    current_step VARCHAR(100) NOT NULL,
    bottleneck_step VARCHAR(100) NOT NULL,
    run_duration_ms BIGINT NOT NULL,
    event_count INTEGER NOT NULL,
    interruption_count INTEGER NOT NULL,
    confirmation_wait_count INTEGER NOT NULL,
    total_confirmation_wait_ms BIGINT NOT NULL,
    steps_json TEXT NOT NULL,
    design_signals_json TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_agent_runs_user_created ON agent_runs (user_id, created_at DESC);
CREATE INDEX idx_agent_runs_project_created ON agent_runs (project_id, created_at DESC);
CREATE INDEX idx_agent_run_events_run_created ON agent_run_events (run_id, created_at);
CREATE INDEX idx_agent_run_events_name ON agent_run_events (event_name);
