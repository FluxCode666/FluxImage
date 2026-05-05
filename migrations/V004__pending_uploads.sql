-- 本地兜底上传重试队列
CREATE TABLE IF NOT EXISTS pending_uploads (
  id          SERIAL PRIMARY KEY,
  file_key    VARCHAR(500) NOT NULL,
  local_path  VARCHAR(1000) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  error       TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_uploads_status ON pending_uploads (status);
