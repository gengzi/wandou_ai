CREATE TABLE model_usage_records (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    run_id VARCHAR(64),
    project_id VARCHAR(64),
    canvas_id VARCHAR(64),
    node_id VARCHAR(64),
    capability VARCHAR(32) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    model_display_name VARCHAR(255),
    compatibility_mode VARCHAR(64),
    endpoint VARCHAR(255) NOT NULL,
    request_count INTEGER NOT NULL,
    input_chars INTEGER NOT NULL,
    output_chars INTEGER NOT NULL,
    credits INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL,
    error_message TEXT,
    provider_request_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_ms BIGINT NOT NULL,
    CONSTRAINT fk_model_usage_records_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_model_usage_records_user_created ON model_usage_records (user_id, created_at DESC);
CREATE INDEX idx_model_usage_records_run ON model_usage_records (run_id);
CREATE INDEX idx_model_usage_records_capability ON model_usage_records (capability);
