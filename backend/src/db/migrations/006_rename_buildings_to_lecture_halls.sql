-- Migration 006: Rename buildings -> lecture_halls, building_id -> lecture_hall_id
-- Guard: only run if the old table name exists (fresh installs already have lecture_halls from schema.sql)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'buildings') THEN
    ALTER TABLE buildings RENAME TO lecture_halls;
  END IF;
END
$$;

-- 2. Rename column in active_sessions (only if old column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'active_sessions' AND column_name = 'building_id'
  ) THEN
    ALTER TABLE active_sessions RENAME COLUMN building_id TO lecture_hall_id;
  END IF;
END
$$;

-- 3. Fix foreign key constraint
ALTER TABLE IF EXISTS active_sessions
  DROP CONSTRAINT IF EXISTS active_sessions_building_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'active_sessions_lecture_hall_id_fkey'
  ) THEN
    ALTER TABLE active_sessions
      ADD CONSTRAINT active_sessions_lecture_hall_id_fkey
      FOREIGN KEY (lecture_hall_id) REFERENCES lecture_halls(id) ON DELETE SET NULL;
  END IF;
END
$$;
