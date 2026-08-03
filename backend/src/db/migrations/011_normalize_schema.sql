-- Migration 011: Data Normalization
-- 1. Add unique constraints to prevent duplicate names within scope
-- 2. Remove redundant columns that duplicate FK data

-- 1a. classes: unique (department_id, class_name) — prevent duplicate class names per department
-- schema.sql may create this as an index; drop the index first, then create the constraint
DROP INDEX IF EXISTS uq_classes_dept_name;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_classes_dept_name'
  ) THEN
    ALTER TABLE classes ADD CONSTRAINT uq_classes_dept_name
      UNIQUE (department_id, class_name);
  END IF;
END
$$;

-- 1b. courses: unique (department_id, course_name) — prevent duplicate course names per department
DROP INDEX IF EXISTS uq_courses_dept_name;
DROP INDEX IF EXISTS idx_courses_active_dept_name;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_courses_dept_name'
  ) THEN
    ALTER TABLE courses ADD CONSTRAINT uq_courses_dept_name
      UNIQUE (department_id, course_name);
  END IF;
END
$$;

-- 2a. active_sessions: drop redundant latitude, longitude, radius_meters
-- These duplicate lecture_halls.latitude/longitude/radius via the lecture_hall_id FK.
-- The session cache resolves coordinates from lecture_halls at load time.
ALTER TABLE active_sessions DROP COLUMN IF EXISTS latitude;
ALTER TABLE active_sessions DROP COLUMN IF EXISTS longitude;
ALTER TABLE active_sessions DROP COLUMN IF EXISTS radius_meters;

-- 2b. attendance_records: drop redundant student_name
-- This duplicates student_roster.student_name via the index_number lookup.
-- Reports JOIN to student_roster to get the name; soft-deleted students show as 'Deleted Student'.
ALTER TABLE attendance_records DROP COLUMN IF EXISTS student_name;
