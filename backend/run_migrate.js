const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: 'postgres://postgres:1234567890@localhost:5432/postgres' });

async function migrate() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'src/db/migrations/002_course_lecturers.sql'), 'utf8');
    await pool.query(sql);
    console.log('Migration 002 complete.');
  } catch (e) {
    console.error('Migration failed:', e.message);
  } finally {
    pool.end();
  }
}
migrate();
