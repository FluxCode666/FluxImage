-- 默认站点展示配置
INSERT INTO system_config (config_key, config_value)
VALUES
    ('site_name', 'FluxImage'),
    ('site_subtitle', 'AI Creative Studio')
ON CONFLICT (config_key) DO NOTHING;
