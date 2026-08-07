/**
 * CI/test fixtures — creates the minimum data the Jest suites depend on that
 * src/db/seed.js does not provide:
 *   - lecture hall #1 with the coordinates used by check-in tests (100m fence)
 *   - an academic year + an ACTIVE semester (sessions require one)
 *
 * Idempotent: safe to run on a fresh database or to re-run locally.
 * Used by .github/workflows/ci.yml after `node scripts/init-db.js` and
 * `node src/db/seed.js`.
 */
const { pool } = require('../src/config/db');
require('dotenv').config();

async function main() {
  // Lecture hall #1 — the suites hard-code lecture_hall_id: 1 and the
  // BUILDING_LAT/BUILDING_LON coordinates used by double-submit, matrix,
  // geofencing-toggle and e2e-flows tests.
  await pool.query(
    `INSERT INTO lecture_halls (name, latitude, longitude, radius)
     SELECT 'Main Lecture Hall', 7.363042, -2.351278, 100
     WHERE NOT EXISTS (SELECT 1 FROM lecture_halls WHERE id = 1)`
  );

  // Academic year + active semester (label unique per university).
  await pool.query(
    `INSERT INTO academic_years (label, start_year, end_year, university_id)
     SELECT '2026/2027 Academic Year', 2026, 2027, 1
     WHERE NOT EXISTS (SELECT 1 FROM academic_years WHERE label = '2026/2027 Academic Year')`
  );

  await pool.query(
    `INSERT INTO semesters (academic_year_id, number, label, start_date, end_date, is_active)
     SELECT ay.id, 1, ay.label || ' - Semester 1', '2026-09-01', '2027-01-15', TRUE
     FROM academic_years ay
     WHERE ay.label = '2026/2027 Academic Year'
       AND NOT EXISTS (SELECT 1 FROM semesters s WHERE s.academic_year_id = ay.id AND s.number = 1)`
  );

  // Only one semester may be active at a time — make sure it's this one.
  await pool.query(
    `UPDATE semesters SET is_active = TRUE
     WHERE academic_year_id = (SELECT id FROM academic_years WHERE label = '2026/2027 Academic Year')
       AND number = 1`
  );

  const sem = await pool.query('SELECT id, label, is_active FROM semesters WHERE is_active = TRUE LIMIT 1');
  console.log('CI fixtures ready. Active semester:', JSON.stringify(sem.rows[0] || null));
  await pool.end();
}

main().catch((e) => {
  console.error('CI fixtures failed:', e.message);
  process.exit(1);
});
