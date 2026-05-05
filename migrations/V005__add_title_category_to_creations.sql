-- 为 creations 表添加标题和分类字段
ALTER TABLE creations ADD COLUMN title VARCHAR(100) DEFAULT NULL;
ALTER TABLE creations ADD COLUMN category VARCHAR(50) DEFAULT NULL;
