CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(16) NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash VARCHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  csrf VARCHAR(64) NOT NULL,
  expires_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS knowledge (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  category VARCHAR(64) NOT NULL,
  description VARCHAR(1000) NOT NULL,
  difficulty INT NOT NULL,
  minutes INT NOT NULL,
  importance DOUBLE NOT NULL,
  x DOUBLE NOT NULL,
  y DOUBLE NOT NULL,
  content TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS relations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  source_id BIGINT NOT NULL,
  target_id BIGINT NOT NULL,
  type VARCHAR(16) NOT NULL,
  weight DOUBLE NOT NULL,
  UNIQUE (source_id, target_id, type),
  FOREIGN KEY (source_id) REFERENCES knowledge(id),
  FOREIGN KEY (target_id) REFERENCES knowledge(id)
);
CREATE TABLE IF NOT EXISTS questions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  knowledge_id BIGINT NOT NULL,
  prompt VARCHAR(2000) NOT NULL,
  options TEXT NOT NULL,
  answer INT NOT NULL,
  explanation TEXT NOT NULL,
  difficulty INT NOT NULL,
  FOREIGN KEY (knowledge_id) REFERENCES knowledge(id)
);
CREATE TABLE IF NOT EXISTS learning_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  knowledge_id BIGINT NOT NULL,
  kind VARCHAR(16) NOT NULL,
  seconds INT NOT NULL DEFAULT 0,
  correct INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (knowledge_id) REFERENCES knowledge(id)
);
CREATE TABLE IF NOT EXISTS assessments (
  id VARCHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  knowledge_id BIGINT NOT NULL,
  question_ids VARCHAR(1000) NOT NULL,
  created_at BIGINT NOT NULL,
  completed_at BIGINT,
  result TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (knowledge_id) REFERENCES knowledge(id)
);
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  action VARCHAR(128) NOT NULL,
  detail VARCHAR(1000) NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX idx_relation_target ON relations(target_id, type);
CREATE INDEX idx_events_user_time ON learning_events(user_id, created_at);
