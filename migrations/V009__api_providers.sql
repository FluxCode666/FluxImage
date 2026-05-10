-- ============================================
-- V009: API 供应商表 & 移除模型级 API 配置
-- ============================================

-- 供应商表
CREATE TABLE IF NOT EXISTS api_providers (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(100) NOT NULL,
    api_base_url     VARCHAR(500) NOT NULL,
    api_key          VARCHAR(500) NOT NULL,
    priority         INT     NOT NULL DEFAULT 0,
    is_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    supported_models TEXT    NOT NULL DEFAULT '[]',
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 将现有模型级 API 配置迁移为供应商记录（仅在列存在时执行）
DO $$
BEGIN
    -- 针对每个有独立 api_key 的模型，创建一个供应商
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'model_config' AND column_name = 'api_base_url'
    ) THEN
        INSERT INTO api_providers (name, api_base_url, api_key, priority, is_enabled, supported_models)
        SELECT
            '模型 ' || model_id || ' 迁移',
            api_base_url,
            api_key,
            0,
            TRUE,
            '["' || model_id || '"]'
        FROM model_config
        WHERE api_key IS NOT NULL AND api_key != '';
    END IF;

    -- 将全局默认 API 配置迁移为供应商记录（最低优先级兜底）
    IF EXISTS (SELECT 1 FROM system_config WHERE config_key = 'default_api_key' AND config_value IS NOT NULL AND config_value != '')
       AND EXISTS (SELECT 1 FROM system_config WHERE config_key = 'default_api_base_url' AND config_value IS NOT NULL AND config_value != '')
    THEN
        INSERT INTO api_providers (name, api_base_url, api_key, priority, is_enabled, supported_models)
        SELECT
            '全局默认(迁移)',
            (SELECT config_value FROM system_config WHERE config_key = 'default_api_base_url'),
            (SELECT config_value FROM system_config WHERE config_key = 'default_api_key'),
            -1,
            TRUE,
            '["*"]';
    END IF;
END
$$;

-- 移除模型表中的 API 相关列
ALTER TABLE model_config DROP COLUMN IF EXISTS api_base_url;
ALTER TABLE model_config DROP COLUMN IF EXISTS api_key;

-- 清理全局默认 API 配置
DELETE FROM system_config WHERE config_key IN ('default_api_key', 'default_api_base_url');
