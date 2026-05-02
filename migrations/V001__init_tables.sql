-- ============================================
-- V001: 初始化表结构
-- Nano Banana AI 绘图平台
-- ============================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    email           VARCHAR(100) NOT NULL UNIQUE,
    password        VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'user',
    drawing_points  INT          NOT NULL DEFAULT 10,
    creation_count  INT          NOT NULL DEFAULT 0,
    last_checkin_date DATE       DEFAULT NULL,
    checkin_count   INT          NOT NULL DEFAULT 0,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 创作记录表
CREATE TABLE IF NOT EXISTS creations (
    id         SERIAL PRIMARY KEY,
    user_id    INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt     TEXT,
    image_url  VARCHAR(255) NOT NULL,
    model      VARCHAR(255),
    size       VARCHAR(255),
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_creations_user_id ON creations(user_id);

-- 灵感图片表
CREATE TABLE IF NOT EXISTS inspirations (
    id         SERIAL PRIMARY KEY,
    url        VARCHAR(1000) NOT NULL,
    prompt     TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 公告表
CREATE TABLE IF NOT EXISTS announcements (
    id           SERIAL PRIMARY KEY,
    content      TEXT    NOT NULL,
    is_important BOOLEAN NOT NULL DEFAULT FALSE,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT NOW()
);

-- 用户 API Key 配置表
CREATE TABLE IF NOT EXISTS user_api_config (
    id           SERIAL PRIMARY KEY,
    user_id      INT          NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    api_key      VARCHAR(500) NOT NULL,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    usage_count  INT          NOT NULL DEFAULT 0,
    api_base_url VARCHAR(255),
    created_at   TIMESTAMP    DEFAULT NOW(),
    updated_at   TIMESTAMP    DEFAULT NOW()
);
