-- Migration 005: Rename campuses → buildings, campus_id → building_id
-- For a single-department system, "buildings" (lecturer halls) replaces "campuses"

-- 1. Rename the table
ALTER TABLE IF EXISTS campuses RENAME TO buildings;

-- 2. Rename the column in active_sessions
ALTER TABLE IF EXISTS active_sessions RENAME COLUMN campus_id TO building_id;

-- 3. Rename the index if it exists
ALTER INDEX IF EXISTS idx_active_sessions_campus RENAME TO idx_active_sessions_building;

-- 4. Rename the constraint if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'active_sessions_campus_id_fkey') THEN
    ALTER TABLE active_sessions RENAME CONSTRAINT active_sessions_campus_id_fkey TO active_sessions_building_id_fkey;
  END IF;
END $$;

-- 5. Update the seed data name (Main Campus → Main Building)
UPDATE buildings SET name = 'Main Building' WHERE name = 'Main Campus';
