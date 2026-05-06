-- ============================================
-- V011: 供应商增加 response_format 字段
-- ============================================

ALTER TABLE api_providers ADD COLUMN IF NOT EXISTS response_format VARCHAR(20) NOT NULL DEFAULT 'url';
