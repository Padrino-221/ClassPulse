-- Migration 003: Many-to-many classes ↔ lecturers
CREATE TABLE IF NOT EXISTS class_lecturers (
    class_id    INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
    lecturer_id INTEGER NOT NULL REFERENCES lecturers(id) ON DELETE CASCADE,
    PRIMARY KEY (class_id, lecturer_id)
);

INSERT INTO class_lecturers (class_id, lecturer_id)
SELECT class_id, lecturer_id FROM classes WHERE lecturer_id IS NOT NULL;

ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_lecturer_id_fkey;
ALTER TABLE classes DROP COLUMN IF EXISTS lecturer_id;
DROP INDEX IF EXISTS idx_classes_lecturer;
