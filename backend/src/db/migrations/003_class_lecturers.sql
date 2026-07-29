-- Migration 003: Many-to-many classes <-> lecturers
-- Idempotent: only runs if lecturer_id column still exists on classes

CREATE TABLE IF NOT EXISTS class_lecturers (
    class_id    INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
    lecturer_id INTEGER NOT NULL REFERENCES lecturers(id) ON DELETE CASCADE,
    PRIMARY KEY (class_id, lecturer_id)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='classes' AND column_name='lecturer_id') THEN
    INSERT INTO class_lecturers (class_id, lecturer_id)
    SELECT class_id, lecturer_id FROM classes WHERE lecturer_id IS NOT NULL
    ON CONFLICT DO NOTHING;
    ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_lecturer_id_fkey;
    ALTER TABLE classes DROP COLUMN IF EXISTS lecturer_id;
    DROP INDEX IF EXISTS idx_classes_lecturer;
  END IF;
END $$;
