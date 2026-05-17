ALTER TABLE assets ADD COLUMN purpose VARCHAR(50) NOT NULL DEFAULT 'library_asset';
ALTER TABLE assets ADD COLUMN parse_status VARCHAR(50) NOT NULL DEFAULT 'not_required';
ALTER TABLE assets ADD COLUMN parsed_text TEXT;
ALTER TABLE assets ADD COLUMN parsed_summary TEXT;
ALTER TABLE assets ADD COLUMN parse_error TEXT;
ALTER TABLE assets ADD COLUMN metadata_json TEXT;

UPDATE assets
SET purpose = CASE
        WHEN lower(type) = 'image' THEN 'reference_image'
        ELSE 'library_asset'
    END,
    parse_status = CASE
        WHEN lower(type) = 'image' THEN 'not_required'
        ELSE parse_status
    END;

CREATE INDEX idx_assets_project_purpose_created_at ON assets (project_id, purpose, created_at DESC);
CREATE INDEX idx_assets_project_parse_status ON assets (project_id, parse_status);
