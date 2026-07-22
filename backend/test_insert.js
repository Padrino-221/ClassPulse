const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgres://postgres:1234567890@localhost:5432/postgres' });

async function test() {
  try {
    const result = await p.query(
      `INSERT INTO active_sessions (
         course_code, class_id, lecturer_id, week_number, pin_seed,
         campus_id, latitude, longitude, radius_meters, expires_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '1 minute' * $10)
       RETURNING session_id, pin_seed, created_at, expires_at`,
      ['CS101', 1, 1, 1, 'test-seed', 1, 5.65, -0.186, 400, 120]
    );
    console.log('Success:', JSON.stringify(result.rows));
    // Clean up
    await p.query("DELETE FROM active_sessions WHERE pin_seed = 'test-seed'");
  } catch (e) {
    console.error('Error:', e.message);
    console.error('Detail:', e.detail);
  } finally {
    p.end();
  }
}
test();
