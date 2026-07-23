const express = require('express');
const { pool } = require('../config/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken('admin'));

// GET /api/reports/summary — aggregate stats per course and per class
router.get('/summary', async (req, res) => {
  try {
    const { course_code, class_id } = req.query;

    // Per-course summary
    let courseQuery = `
      SELECT
        s.course_code,
        c.course_name,
        COUNT(DISTINCT s.session_id)::int AS total_sessions,
        COUNT(DISTINCT ar.index_number)::int AS unique_students,
        COUNT(ar.record_id)::int AS total_checkins
      FROM active_sessions s
      JOIN courses c ON s.course_code = c.course_code
      LEFT JOIN attendance_records ar ON s.session_id = ar.session_id
      WHERE (s.is_active = FALSE OR s.expires_at < NOW())
    `;
    const courseParams = [];
    if (course_code) {
      courseParams.push(course_code);
      courseQuery += ` AND s.course_code = $${courseParams.length}`;
    }
    courseQuery += ` GROUP BY s.course_code, c.course_name ORDER BY c.course_name`;

    const courseResult = await pool.query(courseQuery, courseParams);

    // Compute average attendance % per course using roster size
    const coursesWithAvg = await Promise.all(
      courseResult.rows.map(async (row) => {
        const rosterRes = await pool.query(
          `SELECT COUNT(*)::int AS roster_size
           FROM student_roster sr
           WHERE sr.class_id IN (
             SELECT DISTINCT s.class_id FROM active_sessions s WHERE s.course_code = $1
           )`,
          [row.course_code]
        );
        const rosterSize = rosterRes.rows[0]?.roster_size || 0;
        const avgPct = rosterSize > 0 && row.total_sessions > 0
          ? Math.round((row.total_checkins / (rosterSize * row.total_sessions)) * 1000) / 10
          : 0;
        return { ...row, roster_size: rosterSize, avg_attendance_pct: avgPct };
      })
    );

    // Per-class summary
    let classQuery = `
      SELECT
        cl.class_id,
        cl.class_name,
        COUNT(DISTINCT s.session_id)::int AS total_sessions,
        COUNT(DISTINCT sr.index_number)::int AS total_students,
        COUNT(DISTINCT ar.index_number)::int AS students_attended,
        COUNT(ar.record_id)::int AS total_checkins
      FROM classes cl
      LEFT JOIN student_roster sr ON cl.class_id = sr.class_id
      LEFT JOIN active_sessions s ON cl.class_id = s.class_id
        AND (s.is_active = FALSE OR s.expires_at < NOW())
      LEFT JOIN attendance_records ar ON s.session_id = ar.session_id
    `;
    const classParams = [];
    const conditions = [];
    if (class_id) {
      classParams.push(class_id);
      conditions.push(`cl.class_id = $${classParams.length}`);
    }
    if (course_code) {
      classParams.push(course_code);
      conditions.push(`s.course_code = $${classParams.length}`);
    }
    if (conditions.length > 0) {
      classQuery += ` WHERE ${conditions.join(' AND ')}`;
    }
    classQuery += ` GROUP BY cl.class_id, cl.class_name ORDER BY cl.class_name`;

    const classResult = await pool.query(classQuery, classParams);

    const classesWithAvg = classResult.rows.map((row) => {
      const avgPct = row.total_students > 0 && row.total_sessions > 0
        ? Math.round((row.total_checkins / (row.total_students * row.total_sessions)) * 1000) / 10
        : 0;
      return { ...row, avg_attendance_pct: avgPct };
    });

    // Overall stats
    const overallRes = await pool.query(`
      SELECT
        COUNT(DISTINCT s.session_id)::int AS total_sessions,
        COUNT(DISTINCT ar.index_number)::int AS total_students,
        COUNT(ar.record_id)::int AS total_checkins
      FROM active_sessions s
      LEFT JOIN attendance_records ar ON s.session_id = ar.session_id
      WHERE (s.is_active = FALSE OR s.expires_at < NOW())
    `);
    const overall = overallRes.rows[0];

    res.json({
      overall,
      courses: coursesWithAvg,
      classes: classesWithAvg,
    });
  } catch (err) {
    console.error('Report summary error:', err);
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

// GET /api/reports/weekly?course_code=&class_id= — per-week breakdown for charts
router.get('/weekly', async (req, res) => {
  try {
    const { course_code, class_id } = req.query;

    let query = `
      SELECT
        s.week_number,
        s.course_code,
        cl.class_name,
        cl.class_id,
        COUNT(DISTINCT ar.index_number)::int AS attended,
        (SELECT COUNT(*) FROM student_roster WHERE class_id = s.class_id)::int AS total_students
      FROM active_sessions s
      JOIN classes cl ON s.class_id = cl.class_id
      LEFT JOIN attendance_records ar ON s.session_id = ar.session_id
      WHERE (s.is_active = FALSE OR s.expires_at < NOW())
    `;
    const params = [];
    const conditions = [];

    if (course_code) {
      params.push(course_code);
      conditions.push(`s.course_code = $${params.length}`);
    }
    if (class_id) {
      params.push(class_id);
      conditions.push(`s.class_id = $${params.length}`);
    }
    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }
    query += ` GROUP BY s.week_number, s.course_code, cl.class_name, s.class_id, cl.class_id ORDER BY s.week_number`;

    const result = await pool.query(query, params);

    const weekly = result.rows.map((row) => ({
      ...row,
      attendance_pct: row.total_students > 0
        ? Math.round((row.attended / row.total_students) * 1000) / 10
        : 0,
    }));

    res.json({ weekly });
  } catch (err) {
    console.error('Report weekly error:', err);
    res.status(500).json({ error: 'Failed to generate weekly report.' });
  }
});

// GET /api/reports/export?course_code=&class_id= — CSV download
router.get('/export', async (req, res) => {
  try {
    const { course_code, class_id } = req.query;

    let query = `
      SELECT
        s.course_code,
        cl.class_name,
        s.week_number,
        ar.student_name,
        ar.index_number,
        ar.verification_method,
        ar.timestamp
      FROM attendance_records ar
      JOIN active_sessions s ON ar.session_id = s.session_id
      JOIN classes cl ON s.class_id = cl.class_id
      WHERE 1=1
    `;
    const params = [];
    const conditions = [];

    if (course_code) {
      params.push(course_code);
      conditions.push(`s.course_code = $${params.length}`);
    }
    if (class_id) {
      params.push(class_id);
      conditions.push(`s.class_id = $${params.length}`);
    }
    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }
    query += ` ORDER BY s.course_code, cl.class_name, s.week_number, ar.student_name`;

    const result = await pool.query(query, params);

    const header = 'Course,Class,Week,Student,Index,Method,Date\n';
    const rows = result.rows.map((r) =>
      [
        r.course_code,
        `"${r.class_name}"`,
        r.week_number,
        `"${r.student_name}"`,
        r.index_number,
        r.verification_method,
        new Date(r.timestamp).toISOString(),
      ].join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.csv');
    res.send(header + rows);
  } catch (err) {
    console.error('Report export error:', err);
    res.status(500).json({ error: 'Failed to export report.' });
  }
});

// GET /api/reports/filters — return available courses and classes for filter dropdowns
router.get('/filters', async (req, res) => {
  try {
    const [coursesRes, classesRes] = await Promise.all([
      pool.query('SELECT course_code, course_name FROM courses ORDER BY course_name'),
      pool.query('SELECT class_id, class_name FROM classes ORDER BY class_name'),
    ]);
    res.json({
      courses: coursesRes.rows,
      classes: classesRes.rows,
    });
  } catch (err) {
    console.error('Report filters error:', err);
    res.status(500).json({ error: 'Failed to load filters.' });
  }
});

module.exports = router;
