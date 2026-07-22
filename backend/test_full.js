const { Pool } = require('pg');
const sessionCache = require('./src/services/sessionCache');
const { getCurrentPin, generateSeed } = require('./src/services/pin');

const pool = new Pool({ connectionString: 'postgres://postgres:1234567890@localhost:5432/postgres' });

async function test() {
  try {
    await sessionCache.loadCampuses(pool);
    
    const campus = sessionCache.getCampus(1);
    console.log('Campus:', campus);
    
    if (!campus) {
      console.log('Campus not found!');
      return;
    }

    const pinSeed = generateSeed();
    
    const result = await pool.query(
      `INSERT INTO active_sessions (
         course_code, class_id, lecturer_id, week_number, pin_seed,
         campus_id, latitude, longitude, radius_meters, expires_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '1 minute' * $10)
       RETURNING session_id, pin_seed, created_at, expires_at`,
      ['CS101', 1, 1, 1, pinSeed, 1, campus.latitude, campus.longitude, campus.radius, 120]
    );

    const session = result.rows[0];
    console.log('Session created:', session.session_id);

    sessionCache.set({
      session_id: session.session_id,
      pin_seed: session.pin_seed,
      course_code: 'CS101',
      class_id: 1,
      week_number: 1,
      is_active: true,
      campus_id: campus.id,
      campus_name: campus.name,
      campus_latitude: campus.latitude,
      campus_longitude: campus.longitude,
      campus_radius: campus.radius,
    });

    const currentPin = getCurrentPin(pinSeed);
    console.log('PIN:', currentPin);
    console.log('All good!');
    
    await pool.query("DELETE FROM active_sessions WHERE session_id = $1", [session.session_id]);
  } catch (e) {
    console.error('ERROR:', e.message);
    console.error('Stack:', e.stack);
  } finally {
    pool.end();
  }
}
test();
