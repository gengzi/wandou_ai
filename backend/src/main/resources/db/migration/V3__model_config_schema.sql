CREATE TABLE model_configs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    capability VARCHAR(32) NOT NULL,
    provider VARCHAR(64) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    base_url VARCHAR(500) NOT NULL,
    model_name VARCHAR(160) NOT NULL,
    api_key_secret VARCHAR(1000),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT fk_model_configs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_model_configs_user ON model_configs (user_id);
CREATE INDEX idx_model_configs_user_capability ON model_configs (user_id, capability);
