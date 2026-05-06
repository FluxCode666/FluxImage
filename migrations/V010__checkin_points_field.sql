-- 新增 checkin_points 字段，单独追踪签到积分（与充值积分分开）
ALTER TABLE users ADD COLUMN IF NOT EXISTS checkin_points INT NOT NULL DEFAULT 0;
