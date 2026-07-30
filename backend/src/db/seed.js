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
  await pool.query('DELETE FROM departments');
  await pool.query('DELETE FROM schools');
  await pool.query('DELETE FROM universities');

  // University
  const uniRes = await pool.query(
    'INSERT INTO universities (name, code) VALUES ($1, $2) RETURNING id',
    ['Demo University', 'DU']
  );
  const universityId = uniRes.rows[0].id;

  // School
  const schoolRes = await pool.query(
    'INSERT INTO schools (name, code, university_id) VALUES ($1, $2, $3) RETURNING id',
    ['School of Computing', 'SC', universityId]
  );
  const schoolId = schoolRes.rows[0].id;

  // Department
  const deptRes = await pool.query(
    'INSERT INTO departments (name, code, school_id) VALUES ($1, $2, $3) RETURNING id',
    ['Computer Science', 'CS', schoolId]
  );
  const departmentId = deptRes.rows[0].id;

  // Admin
  await pool.query(
    'INSERT INTO admins (name, email, password_hash, role, university_id) VALUES ($1, $2, $3, $4, $5)',
    ['System Admin', 'admin@classpulse.com', adminHash, 'university', universityId]
  );

  // Lecturers
  await pool.query(
    'INSERT INTO lecturers (name, email, password_hash, department_id) VALUES ($1, $2, $3, $4)',
    ['Dr. Kwame Asante', 'kasante@university.edu', lecturerHash, departmentId]
  );
  await pool.query(
    'INSERT INTO lecturers (name, email, password_hash, department_id) VALUES ($1, $2, $3, $4)',
    ['Prof. Ama Serwaa', 'aserwaa@university.edu', lecturerHash, departmentId]
  );

  // Courses
  await pool.query(
    'INSERT INTO courses (course_code, course_name, total_weeks, department_id) VALUES ($1, $2, $3, $4)',
    ['CS101', 'Introduction to Computer Science', 12, departmentId]
  );
  await pool.query(
    'INSERT INTO courses (course_code, course_name, total_weeks, department_id) VALUES ($1, $2, $3, $4)',
    ['CS201', 'Data Structures & Algorithms', 12, departmentId]
  );
  await pool.query(
    'INSERT INTO courses (course_code, course_name, total_weeks, department_id) VALUES ($1, $2, $3, $4)',
    ['MATH101', 'Calculus I', 12, departmentId]
  );

  // Course ↔ Lecturer assignments (many-to-many)
  await pool.query('INSERT INTO course_lecturers (course_code, lecturer_id) VALUES ($1, $2)', ['CS101', 1]);
  await pool.query('INSERT INTO course_lecturers (course_code, lecturer_id) VALUES ($1, $2)', ['CS201', 1]);
  await pool.query('INSERT INTO course_lecturers (course_code, lecturer_id) VALUES ($1, $2)', ['MATH101', 2]);

  // Classes
  await pool.query('INSERT INTO classes (class_name, department_id) VALUES ($1, $2)', ['BSc Computer Science - Year 1', departmentId]);
  await pool.query('INSERT INTO classes (class_name, department_id) VALUES ($1, $2)', ['BSc Computer Science - Year 2', departmentId]);

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
