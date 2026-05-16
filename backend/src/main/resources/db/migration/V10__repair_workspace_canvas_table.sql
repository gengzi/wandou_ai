CREATE TABLE IF NOT EXISTS canvases (
    id VARCHAR(100) PRIMARY KEY,
    project_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

INSERT INTO canvases (id, project_id, created_at, updated_at)
SELECT p.canvas_id, p.id, p.created_at, p.created_at
FROM projects p
WHERE NOT EXISTS (
    SELECT 1
    FROM canvases c
    WHERE c.id = p.canvas_id
);

CREATE INDEX IF NOT EXISTS idx_canvases_project_id ON canvases (project_id);
