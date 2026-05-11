-- 为 model_config 表添加 prompt_max_length 字段
-- NULL 表示使用全局字数限制，非 NULL 则优先使用该模型的独立限制
ALTER TABLE model_config ADD COLUMN IF NOT EXISTS prompt_max_length INTEGER;
