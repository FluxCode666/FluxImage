-- ============================================
-- V002: 系统配置 & 模型配置表
-- ============================================

-- 系统全局配置（键值对）
CREATE TABLE IF NOT EXISTS system_config (
    id           SERIAL PRIMARY KEY,
    config_key   VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT,
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 模型配置
CREATE TABLE IF NOT EXISTS model_config (
    id            SERIAL PRIMARY KEY,
    model_id      VARCHAR(100) NOT NULL UNIQUE,
    display_name  VARCHAR(100) NOT NULL,
    icon          VARCHAR(20)  NOT NULL DEFAULT '🤖',
    description   VARCHAR(255) NOT NULL DEFAULT '',
    api_base_url  VARCHAR(500),
    api_key       VARCHAR(500),
    is_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order    INT     NOT NULL DEFAULT 0,
    points_cost   INT     NOT NULL DEFAULT 1,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
