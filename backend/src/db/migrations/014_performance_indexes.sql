-- Partial index for the auto-activate cron: only scans inactive sessions with scheduled_at
CREATE INDEX IF NOT EXISTS idx_active_sessions_auto_activate
  ON active_sessions(scheduled_at, expires_at)
  WHERE is_active = FALSE AND scheduled_at IS NOT NULL;

-- Covering index for attendance_records session lookups (avoids heap fetch)
CREATE INDEX IF NOT EXISTS idx_attendance_session_method
  ON attendance_records(session_id, index_number, verification_method);
