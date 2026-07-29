-- 002: Many-to-many lecturers <-> courses
-- Idempotent: only runs if lecturer_id column still exists on courses

CREATE TABLE IF NOT EXISTS course_lecturers (
    course_code VARCHAR(20) NOT NULL REFERENCES courses(course_code) ON DELETE CASCADE,
    lecturer_id INTEGER NOT NULL REFERENCES lecturers(id) ON DELETE CASCADE,
    PRIMARY KEY (course_code, lecturer_id)
);

-- Migrate existing single-lecturer assignments (only if old column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='courses' AND column_name='lecturer_id') THEN
    INSERT INTO course_lecturers (course_code, lecturer_id)
    SELECT course_code, lecturer_id FROM courses
    ON CONFLICT DO NOTHING;
    ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_lecturer_id_fkey;
    ALTER TABLE courses DROP COLUMN lecturer_id;
  END IF;
END $$;
