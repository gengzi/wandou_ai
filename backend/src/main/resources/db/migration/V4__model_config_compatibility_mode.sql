ALTER TABLE model_configs
    ADD COLUMN compatibility_mode VARCHAR(64) NOT NULL DEFAULT 'openai';

UPDATE model_configs
SET compatibility_mode = 'qwave-task'
WHERE provider = 'qingyun'
  AND capability IN ('image', 'video');
