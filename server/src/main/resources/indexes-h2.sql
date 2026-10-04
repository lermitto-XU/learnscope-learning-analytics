CREATE INDEX IF NOT EXISTS idx_relation_target ON relations(target_id, type);
CREATE INDEX IF NOT EXISTS idx_events_user_time ON learning_events(user_id, created_at);
