// Soft delete utility: sets deleted_at on a row instead of hard-deleting.

const ALLOWED_TABLES = {
  courses: ['course_code', 'course_id'],
  classes: ['class_id'],
  student_roster: ['student_id', 'index_number'],
  active_sessions: ['session_id'],
  attendance_records: ['record_id'],
  semesters: ['semester_id'],
};

async function softDelete(pool, table, idColumn, idValue) {
  if (!ALLOWED_TABLES[table]) {
    throw new Error(`Table "${table}" not allowed for soft delete`);
  }
  if (!ALLOWED_TABLES[table].includes(idColumn)) {
    throw new Error(`Column "${idColumn}" not allowed on table "${table}"`);
  }
  const result = await pool.query(
    `UPDATE ${table} SET deleted_at = NOW() WHERE ${idColumn} = $1 AND deleted_at IS NULL RETURNING ${idColumn}`,
    [idValue]
  );
  return result.rows.length > 0;
}

async function restore(pool, table, idColumn, idValue) {
  if (!ALLOWED_TABLES[table]) {
    throw new Error(`Table "${table}" not allowed for restore`);
  }
  if (!ALLOWED_TABLES[table].includes(idColumn)) {
    throw new Error(`Column "${idColumn}" not allowed on table "${table}"`);
  }
  const result = await pool.query(
    `UPDATE ${table} SET deleted_at = NULL WHERE ${idColumn} = $1 RETURNING ${idColumn}`,
    [idValue]
  );
  return result.rows.length > 0;
}

module.exports = { softDelete, restore };
