-- ============================================
-- V013: 供应商增加 provider_type 字段
-- 支持 openai（默认）和 modelscope 两种协议
-- ============================================

ALTER TABLE api_providers ADD COLUMN IF NOT EXISTS provider_type VARCHAR(20) NOT NULL DEFAULT 'openai';
