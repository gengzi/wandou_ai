CREATE TABLE tasks (
    id VARCHAR(100) PRIMARY KEY,
    run_id VARCHAR(100) NOT NULL,
    project_id VARCHAR(100) NOT NULL,
    canvas_id VARCHAR(100) NOT NULL,
    node_id VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    progress INTEGER NOT NULL,
    message TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE assets (
    id VARCHAR(100) PRIMARY KEY,
    project_id VARCHAR(100) NOT NULL,
    canvas_id VARCHAR(100) NOT NULL,
    node_id VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    object_key TEXT,
    thumbnail_object_key TEXT,
    content_type VARCHAR(100),
    thumbnail_content_type VARCHAR(100),
    size_bytes BIGINT,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_tasks_project_id ON tasks (project_id);
CREATE INDEX idx_tasks_run_id ON tasks (run_id);
CREATE INDEX idx_tasks_updated_at ON tasks (updated_at);
CREATE INDEX idx_assets_project_id ON assets (project_id);
CREATE INDEX idx_assets_canvas_id ON assets (canvas_id);
CREATE INDEX idx_assets_created_at ON assets (created_at);
