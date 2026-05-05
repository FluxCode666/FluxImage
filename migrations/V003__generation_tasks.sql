CREATE TABLE IF NOT EXISTS generation_tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  prompt TEXT,
  model VARCHAR(255),
  size VARCHAR(50),
  quantity INTEGER NOT NULL DEFAULT 1,
  result TEXT,
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_generation_tasks_user_status ON generation_tasks(user_id, status);
