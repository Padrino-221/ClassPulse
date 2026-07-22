const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgres://postgres:1234567890@localhost:5432/postgres' });

async function check() {
  try {
    const courses = await p.query('SELECT course_code, course_name, lecturer_id FROM courses');
    console.log('Courses:', JSON.stringify(courses.rows));
    
    const classes = await p.query('SELECT class_id, class_name, lecturer_id FROM classes');
    console.log('Classes:', JSON.stringify(classes.rows));
    
    const campuses = await p.query('SELECT id, name, latitude, longitude, radius FROM campuses');
    console.log('Campuses:', JSON.stringify(campuses.rows));
  } catch (e) {
    console.error(e.message);
  } finally {
    p.end();
  }
}
check();
