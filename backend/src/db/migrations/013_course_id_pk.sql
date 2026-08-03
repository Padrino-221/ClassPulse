-- Migration 013: Give courses a surrogate id PK.
-- course_code becomes a reusable natural key (partial unique WHERE deleted_at IS NULL).
-- course_lecturers and active_sessions reference courses(id) instead of courses(course_code).

-- 0. Drop FKs that reference courses(course_code) FIRST (they block dropping the PK)
ALTER TABLE course_lecturers DROP CONSTRAINT IF EXISTS course_lecturers_course_code_fkey;
ALTER TABLE active_sessions DROP CONSTRAINT IF EXISTS active_sessions_course_code_fkey;

-- 1. Add surrogate id to courses and promote it to the PK (only if PK is still course_code)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS id SERIAL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'courses'::regclass AND contype = 'p'
    AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'courses'::regclass AND attname = 'course_code')]
  ) THEN
    ALTER TABLE courses DROP CONSTRAINT courses_pkey;
    ALTER TABLE courses ADD PRIMARY KEY (id);
  END IF;
END
$$;

-- 2. course_code is no longer globally unique; only unique among non-deleted rows (reusable after soft delete)
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_active_code
  ON courses(course_code) WHERE deleted_at IS NULL;

-- 3. course_name uniqueness within a department should also be partial (was a full UNIQUE constraint)
ALTER TABLE courses DROP CONSTRAINT IF EXISTS uq_courses_dept_name;
DROP INDEX IF EXISTS idx_courses_active_dept_name;
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_active_dept_name
  ON courses(department_id, course_name) WHERE deleted_at IS NULL;

-- 4. course_lecturers: switch identity to course_id
-- (skip if course_id already exists — schema.sql may have created it directly)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute WHERE attrelid = 'course_lecturers'::regclass AND attname = 'course_id'
  ) THEN
    ALTER TABLE course_lecturers ADD COLUMN course_id INTEGER;

    UPDATE course_lecturers cl
    SET course_id = c.id
    FROM courses c
    WHERE c.course_code = cl.course_code;

    ALTER TABLE course_lecturers ALTER COLUMN course_id SET NOT NULL;

    ALTER TABLE course_lecturers DROP CONSTRAINT IF EXISTS course_lecturers_pkey;
    ALTER TABLE course_lecturers DROP COLUMN IF EXISTS course_code;

    ALTER TABLE course_lecturers ADD PRIMARY KEY (course_id, lecturer_id);
    ALTER TABLE course_lecturers
      ADD CONSTRAINT course_lecturers_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- 5. active_sessions: switch FK to course_id (course_code column kept for display + PIN prefix)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute WHERE attrelid = 'active_sessions'::regclass AND attname = 'course_id'
  ) THEN
    ALTER TABLE active_sessions ADD COLUMN course_id INTEGER;

    UPDATE active_sessions s
    SET course_id = c.id
    FROM courses c
    WHERE c.course_code = s.course_code;

    ALTER TABLE active_sessions ALTER COLUMN course_id SET NOT NULL;

    ALTER TABLE active_sessions
      ADD CONSTRAINT active_sessions_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- 6. Re-key the one-session-per-course+class+week uniqueness on course_id
DROP INDEX IF EXISTS idx_active_sessions_course_class_week;
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_sessions_course_class_week
  ON active_sessions(course_id, class_id, week_number);
