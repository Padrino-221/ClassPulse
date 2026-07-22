const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
require('dotenv').config();

async function seed() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const lecturerHash = await bcrypt.hash('lecturer123', 10);

  // Clear existing data
  await pool.query('DELETE FROM attendance_records');
  await pool.query('DELETE FROM active_sessions');
  await pool.query('DELETE FROM student_roster');
  await pool.query('DELETE FROM course_lecturers');
  await pool.query('DELETE FROM class_lecturers');
  await pool.query('DELETE FROM classes');
  await pool.query('DELETE FROM courses');
  await pool.query('DELETE FROM lecturers');
  await pool.query('DELETE FROM admins');

  // Admin
  await pool.query(
    'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3)',
    ['System Admin', 'admin@classpulse.com', adminHash]
  );

  // Lecturers
  await pool.query(
    'INSERT INTO lecturers (name, email, password_hash) VALUES ($1, $2, $3)',
    ['Dr. Kwame Asante', 'kasante@university.edu', lecturerHash]
  );
  await pool.query(
    'INSERT INTO lecturers (name, email, password_hash) VALUES ($1, $2, $3)',
    ['Prof. Ama Serwaa', 'aserwaa@university.edu', lecturerHash]
  );

  // Courses
  await pool.query(
    'INSERT INTO courses (course_code, course_name, total_weeks) VALUES ($1, $2, $3)',
    ['CS101', 'Introduction to Computer Science', 12]
  );
  await pool.query(
    'INSERT INTO courses (course_code, course_name, total_weeks) VALUES ($1, $2, $3)',
    ['CS201', 'Data Structures & Algorithms', 12]
  );
  await pool.query(
    'INSERT INTO courses (course_code, course_name, total_weeks) VALUES ($1, $2, $3)',
    ['MATH101', 'Calculus I', 12]
  );

  // Course ↔ Lecturer assignments (many-to-many)
  await pool.query('INSERT INTO course_lecturers (course_code, lecturer_id) VALUES ($1, $2)', ['CS101', 1]);
  await pool.query('INSERT INTO course_lecturers (course_code, lecturer_id) VALUES ($1, $2)', ['CS201', 1]);
  await pool.query('INSERT INTO course_lecturers (course_code, lecturer_id) VALUES ($1, $2)', ['MATH101', 2]);

  // Classes
  await pool.query('INSERT INTO classes (class_name) VALUES ($1)', ['BSc Computer Science - Year 1']);
  await pool.query('INSERT INTO classes (class_name) VALUES ($1)', ['BSc Computer Science - Year 2']);

  // Class ↔ Lecturer assignments (many-to-many)
  await pool.query('INSERT INTO class_lecturers (class_id, lecturer_id) VALUES (1, 1)');
  await pool.query('INSERT INTO class_lecturers (class_id, lecturer_id) VALUES (2, 2)');

  // Students Year 1
  const yr1Students = [
    ['CS2024001', 'Kofi Mensah'],
    ['CS2024002', 'Akua Boateng'],
    ['CS2024003', 'Yaw Asare'],
    ['CS2024004', 'Esi Ofori'],
    ['CS2024005', 'Kwame Nyarko'],
  ];
  for (const [idx, name] of yr1Students) {
    await pool.query(
      'INSERT INTO student_roster (index_number, student_name, class_id) VALUES ($1, $2, 1)',
      [idx, name]
    );
  }

  // Students Year 2
  const yr2Students = [
    ['CS2023001', 'Adwoa Bempong'],
    ['CS2023002', 'Kwasi Agyeman'],
    ['CS2023003', 'Nana Yaa Ampomah'],
    ['CS2023004', 'Kojo Asante'],
    ['CS2023005', 'Abena Adjei'],
  ];
  for (const [idx, name] of yr2Students) {
    await pool.query(
      'INSERT INTO student_roster (index_number, student_name, class_id) VALUES ($1, $2, 2)',
      [idx, name]
    );
  }

  console.log('Seed data inserted successfully.');
  console.log('Admin: admin@classpulse.com / admin123');
  console.log('Lecturer: kasante@university.edu / lecturer123');
  process.exit(0);
}

seed().catch((e) => {
  console.error('Seed error:', e);
  process.exit(1);
});
