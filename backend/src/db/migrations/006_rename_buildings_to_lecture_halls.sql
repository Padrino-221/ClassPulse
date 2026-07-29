-- Migration 006: Clean up buildings → lecture_halls
-- Idempotent: for fresh installs schema.sql already has lecture_halls

-- 1. Drop buildings table if it exists (schema.sql already created lecture_halls)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'buildings') THEN
    -- Drop FK constraints on buildings first to avoid cascade issues
    ALTER TABLE IF EXISTS active_sessions DROP CONSTRAINT IF EXISTS active_sessions_building_id_fkey;
    DROP TABLE IF EXISTS buildings CASCADE;
  END IF;
END
$$;

-- 2. Drop building_id column if it exists (schema.sql already has lecture_hall_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'active_sessions' AND column_name = 'building_id'
  ) THEN
    ALTER TABLE active_sessions DROP COLUMN building_id;
  END IF;
END
$$;
