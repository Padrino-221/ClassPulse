-- Allow lecturers to disable geofencing per session (default ON).
-- When disabled, students check in with PIN + device fingerprint only, and
-- records are stamped verification_method='PIN' so reports stay auditable.
ALTER TABLE active_sessions
  ADD COLUMN geofencing_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- The check-in route now stamps 'PIN' for sessions that opted out of
-- geofencing, so the verification_method CHECK must admit it too.
ALTER TABLE attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_verification_method_check;
ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_verification_method_check
  CHECK (verification_method IN ('GPS', 'MANUAL', 'PIN'));
