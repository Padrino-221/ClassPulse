-- Migration 012: Add soft delete to departments/schools, fix unique constraints, cascade deletes

-- 1. Add deleted_at to schools and departments
ALTER TABLE schools ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- 2. Fix unique constraints: emails should allow re-creation after soft delete
-- Drop the full UNIQUE constraints on emails
ALTER TABLE lecturers DROP CONSTRAINT IF EXISTS lecturers_email_key;
ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_email_key;

-- Replace with partial indexes (only enforce uniqueness for non-deleted rows)
CREATE UNIQUE INDEX IF NOT EXISTS idx_lecturers_active_email
  ON lecturers(email) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_active_email
  ON admins(email) WHERE deleted_at IS NULL;

-- 3. Fix schools/departments unique constraints for soft delete
-- Drop full unique on (school_id, code) and (university_id, code)
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_school_id_code_key;
ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_university_id_code_key;

-- Replace with partial indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_active_code
  ON departments(school_id, code) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_active_code
  ON schools(university_id, code) WHERE deleted_at IS NULL;

-- 4. Also fix the (school_id, name) uniqueness for departments
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_active_name
  ON departments(school_id, name) WHERE deleted_at IS NULL;

-- 5. Fix (university_id, name) uniqueness for schools
CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_active_name
  ON schools(university_id, name) WHERE deleted_at IS NULL;
