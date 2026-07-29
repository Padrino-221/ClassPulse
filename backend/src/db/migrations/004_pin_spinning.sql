DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'active_sessions' AND column_name = 'pin_spinning'
  ) THEN
    ALTER TABLE active_sessions ADD COLUMN pin_spinning BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
END
$$;
