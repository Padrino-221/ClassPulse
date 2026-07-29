-- Migration 008: Add scheduled_at for pre-created inactive sessions
-- Sessions created via POST /schedule are inactive until the cron activates them.

ALTER TABLE active_sessions ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;
