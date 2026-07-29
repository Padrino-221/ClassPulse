-- Fix: change UNIQUE(index_number) to a partial unique index that ignores soft-deleted rows
-- This allows re-creating a student with the same index_number after soft delete.

-- Drop the existing unique constraint
ALTER TABLE student_roster DROP CONSTRAINT IF EXISTS student_roster_index_number_key;

-- Create a partial unique index that only applies to non-deleted rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_roster_active_index
  ON student_roster(index_number)
  WHERE deleted_at IS NULL;

-- Also update the ON CONFLICT handling in bulk import won't be affected
-- since ON CONFLICT on (index_number) requires an exact unique constraint/index
-- The partial index works with ON CONFLICT ON CONSTRAINT but not directly with
-- ON CONFLICT (index_number) in all PG versions. Let's update the bulk import to
-- handle this differently if needed.