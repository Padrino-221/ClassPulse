-- Migration 005: Rename campuses → buildings, campus_id → building_id
-- Idempotent: handles fresh installs and upgrades

-- 1. Rename table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campuses')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'buildings') THEN
    ALTER TABLE campuses RENAME TO buildings;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campuses')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'buildings') THEN
    DROP TABLE campuses CASCADE;
  END IF;
END
$$;

-- 2. Rename column (only if campus_id exists and building_id does NOT exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'active_sessions' AND column_name = 'campus_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'active_sessions' AND column_name = 'building_id'
  ) THEN
    ALTER TABLE active_sessions RENAME COLUMN campus_id TO building_id;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'active_sessions' AND column_name = 'campus_id'
  ) THEN
    -- building_id already exists, just drop campus_id
    ALTER TABLE active_sessions DROP COLUMN campus_id;
  END IF;
END
$$;

-- 3. Rename index
ALTER INDEX IF EXISTS idx_active_sessions_campus RENAME TO idx_active_sessions_building;

-- 4. Rename constraint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'active_sessions_campus_id_fkey') THEN
    ALTER TABLE active_sessions RENAME CONSTRAINT active_sessions_campus_id_fkey TO active_sessions_building_id_fkey;
  END IF;
END $$;

-- 5. Seed data
UPDATE buildings SET name = 'Main Building' WHERE name = 'Main Campus';
