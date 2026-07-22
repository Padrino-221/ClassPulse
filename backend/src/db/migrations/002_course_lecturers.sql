-- 002: Many-to-many lecturers ↔ courses
-- Create junction table, migrate data, drop old FK column

CREATE TABLE IF NOT EXISTS course_lecturers (
    course_code VARCHAR(20) NOT NULL REFERENCES courses(course_code) ON DELETE CASCADE,
    lecturer_id INTEGER NOT NULL REFERENCES lecturers(id) ON DELETE CASCADE,
    PRIMARY KEY (course_code, lecturer_id)
);

-- Migrate existing single-lecturer assignments
INSERT INTO course_lecturers (course_code, lecturer_id)
SELECT course_code, lecturer_id FROM courses
ON CONFLICT DO NOTHING;

-- Drop the old single-lecturer FK column
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_lecturer_id_fkey;
ALTER TABLE courses DROP COLUMN lecturer_id;
