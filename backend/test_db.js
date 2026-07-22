require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Test connection
    const ping = await pool.query('SELECT 1 AS ok');
    console.log('DB connected:', ping.rows[0].ok);

    // Check lecturers
    const lec = await pool.query('SELECT id, name, email FROM lecturers');
    console.log('Lecturers:', JSON.stringify(lec.rows));

    // Check if password matches
    const pw = await pool.query('SELECT id, name, email, password_hash FROM lecturers WHERE email = $1', ['kasante@university.edu']);
    if (pw.rows.length > 0) {
      console.log('Found lecturer');
      const valid = await bcrypt.compare('lecturer123', pw.rows[0].password_hash);
      console.log('Password valid:', valid);
    } else {
      console.log('Lecturer not found');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
