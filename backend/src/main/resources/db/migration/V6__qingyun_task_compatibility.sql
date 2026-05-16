UPDATE model_configs
SET compatibility_mode = 'qingyun-task',
    base_url = 'https://api.qingyuntop.top'
WHERE provider = 'qingyun'
  AND capability IN ('image', 'video');
