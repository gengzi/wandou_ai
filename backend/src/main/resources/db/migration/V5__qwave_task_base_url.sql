UPDATE model_configs
SET base_url = 'https://www.qingbo.dev'
WHERE compatibility_mode = 'qwave-task'
  AND provider = 'qingyun'
  AND base_url = 'https://api.qingyuntop.top';
