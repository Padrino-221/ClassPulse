const bcrypt = require('bcryptjs');
const { pool } = require('./src/config/db');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const adminHash = await bcrypt.hash('admin123', 10);
    const lecturerHash = await bcrypt.hash('lecturer123', 10);

    // Admin
    await client.query(
      `INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3)`,
      ['System Admin', 'admin@classpulse.com', adminHash]
    );

    // Lecturers
    await client.query(
      `INSERT INTO lecturers (name, email, password_hash) VALUES ($1, $2, $3), ($4, $5, $6)`,
      ['Dr. Kwame Asante', 'kasante@university.edu', lecturerHash,
       'Prof. Ama Serwaa', 'aserwaa@university.edu', lecturerHash]
    );

    // Courses (lecturer 1 = Kasante, lecturer 2 = Serwaa)
    await client.query(
      `INSERT INTO courses (course_code, course_name, total_weeks, lecturer_id) VALUES ($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12)`,
      ['CS101', 'Introduction to Computer Science', 12, 1,
       'CS201', 'Data Structures & Algorithms', 12, 1,
       'MATH101', 'Calculus I', 12, 2]
    );

    // Classes
    await client.query(
      `INSERT INTO classes (class_name, lecturer_id) VALUES ($1, $2), ($3, $4)`,
      ['BSc Computer Science - Year 1', 1,
       'BSc Computer Science - Year 2', 1]
    );

    // Student Roster - Year 1 (class_id 1)
    await client.query(
      `INSERT INTO student_roster (index_number, student_name, class_id) VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9), ($10, $11, $12), ($13, $14, $15)`,
      ['CS2024001', 'Kofi Mensah', 1,
       'CS2024002', 'Akua Boateng', 1,
       'CS2024003', 'Yaw Asare', 1,
       'CS2024004', 'Esi Ofori', 1,
       'CS2024005', 'Kwame Nyarko', 1]
    );

    // Student Roster - Year 2 (class_id 2)
    await client.query(
      `INSERT INTO student_roster (index_number, student_name, class_id) VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9), ($10, $11, $12), ($13, $14, $15)`,
      ['CS2023001', 'Adwoa Bempong', 2,
       'CS2023002', 'Kwasi Agyeman', 2,
       'CS2023003', 'Nana Yaa Ampomah', 2,
       'CS2023004', 'Kojo Asante', 2,
       'CS2023005', 'Abena Adjei', 2]
    );

    await client.query('COMMIT');
    console.log('Seed data inserted successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
