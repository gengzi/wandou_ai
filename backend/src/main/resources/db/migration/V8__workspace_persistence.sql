CREATE TABLE projects (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    aspect_ratio VARCHAR(32) NOT NULL,
    canvas_id VARCHAR(100) NOT NULL,
    conversation_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE canvases (
    id VARCHAR(100) PRIMARY KEY,
    project_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE canvas_nodes (
    id VARCHAR(160) PRIMARY KEY,
    canvas_id VARCHAR(100) NOT NULL,
    project_id VARCHAR(100) NOT NULL,
    node_id VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    position_x DOUBLE PRECISION NOT NULL,
    position_y DOUBLE PRECISION NOT NULL,
    data_json TEXT NOT NULL,
    output_json TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uk_canvas_nodes_canvas_node UNIQUE (canvas_id, node_id)
);

CREATE TABLE canvas_edges (
    id VARCHAR(100) PRIMARY KEY,
    canvas_id VARCHAR(100) NOT NULL,
    project_id VARCHAR(100) NOT NULL,
    source_node_id VARCHAR(100) NOT NULL,
    target_node_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uk_canvas_edges_canvas_source_target UNIQUE (canvas_id, source_node_id, target_node_id)
);

CREATE TABLE conversations (
    id VARCHAR(100) PRIMARY KEY,
    project_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE conversation_messages (
    id VARCHAR(100) PRIMARY KEY,
    conversation_id VARCHAR(100) NOT NULL,
    project_id VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    sender VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_projects_created_at ON projects (created_at);
CREATE INDEX idx_canvases_project_id ON canvases (project_id);
CREATE INDEX idx_canvas_nodes_canvas_id ON canvas_nodes (canvas_id);
CREATE INDEX idx_canvas_nodes_project_id ON canvas_nodes (project_id);
CREATE INDEX idx_canvas_edges_canvas_id ON canvas_edges (canvas_id);
CREATE INDEX idx_conversations_project_id ON conversations (project_id);
CREATE INDEX idx_conversation_messages_conversation_id ON conversation_messages (conversation_id);
CREATE INDEX idx_conversation_messages_created_at ON conversation_messages (created_at);
