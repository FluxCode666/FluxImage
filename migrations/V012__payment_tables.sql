-- 支付供应商表
CREATE TABLE IF NOT EXISTS payment_providers (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  channel          VARCHAR(20) NOT NULL DEFAULT 'alipay',
  app_id           VARCHAR(100) NOT NULL,
  private_key      TEXT NOT NULL,
  public_key       TEXT NOT NULL,
  notify_url       VARCHAR(500),
  priority         INT NOT NULL DEFAULT 0,
  is_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at     TIMESTAMP,
  metadata         JSONB,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 积分套餐表
CREATE TABLE IF NOT EXISTS points_packages (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  points           INT NOT NULL,
  price            INT NOT NULL,            -- 价格（分）
  original_price   INT,                     -- 原价（分）
  badge            VARCHAR(50),             -- 角标文字
  is_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 支付订单表
CREATE TABLE IF NOT EXISTS payment_orders (
  id               SERIAL PRIMARY KEY,
  order_no         VARCHAR(64) NOT NULL UNIQUE,
  user_id          INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id       INT REFERENCES points_packages(id) ON DELETE SET NULL,
  provider_id      INT NOT NULL REFERENCES payment_providers(id) ON DELETE RESTRICT,
  channel          VARCHAR(20) NOT NULL DEFAULT 'alipay',
  points           INT NOT NULL,
  amount           INT NOT NULL,            -- 金额（分）
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  trade_no         VARCHAR(100),
  paid_at          TIMESTAMP,
  expired_at       TIMESTAMP,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_order_no   ON payment_orders (order_no);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id    ON payment_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status     ON payment_orders (status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders (created_at);

-- 默认系统配置
INSERT INTO system_config (config_key, config_value) VALUES
  ('payment_selection_mode', 'priority'),
  ('direct_recharge_rate', '10'),
  ('direct_recharge_min', '100'),
  ('direct_recharge_max', '100000')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;
