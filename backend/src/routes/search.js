const express = require('express');
const { pool } = require('../config/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken());

const MAX_RESULTS = 5;

function buildScopeFilter(scope, tableAlias, deptCol = 'department_id') {
  const { level, university_id, school_id, department_id } = scope;
  if (level === 'department') {
    return { clause: `${tableAlias}.${deptCol} = $1`, params: [department_id] };
  }
  if (level === 'school') {
    return { clause: `${tableAlias}.${deptCol} IN (SELECT id FROM departments WHERE school_id = $1)`, params: [school_id] };
  }
  return { clause: 'TRUE', params: [] };
}

router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ results: [] });

    const pattern = `%${q}%`;
    const role = req.user.role;
    const results = [];

    if (role === 'admin') {
      const scope = {
        level: req.user.admin_level,
        university_id: req.user.university_id,
        school_id: req.user.school_id,
        department_id: req.user.department_id,
      };

      // Students
      const sf = buildScopeFilter(scope, 's');
      const students = await pool.query(
        `SELECT s.id, s.student_name, s.index_number, s.class_id, cl.class_name
         FROM student_roster s
         LEFT JOIN classes cl ON cl.class_id = s.class_id
         WHERE s.deleted_at IS NULL
           AND ${sf.clause}
           AND (s.student_name ILIKE $1 OR s.index_number ILIKE $1)
         LIMIT $${sf.params.length + 1}`,
        [...sf.params, pattern, MAX_RESULTS]
      );
      for (const r of students.rows) {
        results.push({ type: 'student', label: r.student_name, sub: r.index_number, route: '/admin/students', routeLabel: 'Students' });
      }

      // Lecturers
      const lf = buildScopeFilter(scope, 'l');
      const lecturers = await pool.query(
        `SELECT l.id, l.name, l.email
         FROM lecturers l
         WHERE l.deleted_at IS NULL
           AND ${lf.clause}
           AND (l.name ILIKE $1 OR l.email ILIKE $1)
         LIMIT $${lf.params.length + 1}`,
        [...lf.params, pattern, MAX_RESULTS]
      );
      for (const r of lecturers.rows) {
        results.push({ type: 'lecturer', label: r.name, sub: r.email, route: '/admin/lecturers', routeLabel: 'Lecturers' });
      }

      // Courses
      const cf = buildScopeFilter(scope, 'c');
      const courses = await pool.query(
        `SELECT c.course_code, c.course_name
         FROM courses c
         WHERE ${cf.clause}
           AND (c.course_code ILIKE $1 OR c.course_name ILIKE $1)
         LIMIT $${cf.params.length + 1}`,
        [...cf.params, pattern, MAX_RESULTS]
      );
      for (const r of courses.rows) {
        results.push({ type: 'course', label: r.course_code, sub: r.course_name, route: '/admin/courses', routeLabel: 'Courses' });
      }

      // Classes
      const clf = buildScopeFilter(scope, 'c');
      const classes = await pool.query(
        `SELECT c.class_id, c.class_name
         FROM classes c
         WHERE ${clf.clause}
           AND c.class_name ILIKE $1
         LIMIT $${clf.params.length + 1}`,
        [...clf.params, pattern, MAX_RESULTS]
      );
      for (const r of classes.rows) {
        results.push({ type: 'class', label: r.class_name, sub: null, route: '/admin/classes', routeLabel: 'Classes' });
      }

      // Lecture Halls (university-scoped)
      if (scope.level === 'university') {
        const halls = await pool.query(
          `SELECT id, name FROM lecture_halls WHERE name ILIKE $1 LIMIT $2`,
          [pattern, MAX_RESULTS]
        );
        for (const r of halls.rows) {
          results.push({ type: 'lecture_hall', label: r.name, sub: null, route: '/admin/lecture-halls', routeLabel: 'Lecture Halls' });
        }
      }
    } else if (role === 'lecturer') {
      const lecturerId = req.user.id;

      // Courses assigned to this lecturer
      const courses = await pool.query(
         `SELECT c.course_code, c.course_name
          FROM courses c
          JOIN course_lecturers cl ON cl.course_id = c.id AND cl.lecturer_id = $1
          WHERE (c.course_code ILIKE $2 OR c.course_name ILIKE $2)
          LIMIT $3`,
        [lecturerId, pattern, MAX_RESULTS]
      );
      for (const r of courses.rows) {
        results.push({ type: 'course', label: r.course_code, sub: r.course_name, route: '/lecturer/live-session', routeLabel: 'Live Session' });
      }

      // Classes assigned to this lecturer
      const classes = await pool.query(
        `SELECT c.class_id, c.class_name
         FROM classes c
         JOIN class_lecturers cl ON cl.class_id = c.class_id AND cl.lecturer_id = $1
         WHERE c.class_name ILIKE $2
         LIMIT $3`,
        [lecturerId, pattern, MAX_RESULTS]
      );
      for (const r of classes.rows) {
        results.push({ type: 'class', label: r.class_name, sub: null, route: '/lecturer/live-session', routeLabel: 'Live Session' });
      }

      // Students in assigned classes
      const students = await pool.query(
        `SELECT s.id, s.student_name, s.index_number
         FROM student_roster s
         JOIN class_lecturers cl ON cl.class_id = s.class_id AND cl.lecturer_id = $1
         WHERE s.deleted_at IS NULL
           AND (s.student_name ILIKE $2 OR s.index_number ILIKE $2)
         LIMIT $3`,
        [lecturerId, pattern, MAX_RESULTS]
      );
      for (const r of students.rows) {
        results.push({ type: 'student', label: r.student_name, sub: r.index_number, route: '/lecturer/history', routeLabel: 'History' });
      }

      // Sessions by this lecturer
      const sessions = await pool.query(
         `SELECT s.session_id, c.course_code, cl.class_name, s.week_number
          FROM active_sessions s
          JOIN classes cl ON cl.class_id = s.class_id
          JOIN courses c ON c.id = s.course_id
          WHERE s.lecturer_id = $1
           AND (c.course_code ILIKE $2 OR cl.class_name ILIKE $2 OR CAST(s.week_number AS TEXT) ILIKE $2)
         ORDER BY s.created_at DESC
         LIMIT $3`,
        [lecturerId, pattern, MAX_RESULTS]
      );
      for (const r of sessions.rows) {
        results.push({ type: 'session', label: `${r.course_code} — Week ${r.week_number}`, sub: r.class_name, route: '/lecturer/history', routeLabel: 'History' });
      }
    }

    res.json({ results });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed.' });
  }
});

module.exports = router;
