const express = require('express');
const { pool } = require('../config/db');
const { verifyToken, verifyScope } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken('admin'));
router.use(verifyScope());

function scopeCourseFilter(level, school_id, department_id, params) {
  let sql = '';
  let idx = params.length + 1;
  if (level === 'department') {
    sql = ` AND co.department_id = $${idx}`;
    params.push(department_id);
  } else if (level === 'school') {
    sql = ` AND co.department_id IN (SELECT id FROM departments WHERE school_id = $${idx})`;
    params.push(school_id);
  }
  return [sql, params];
}

function scopeClassFilter(level, school_id, department_id, params) {
  let sql = '';
  let idx = params.length + 1;
  if (level === 'department') {
    sql = ` AND cl.department_id = $${idx}`;
    params.push(department_id);
  } else if (level === 'school') {
    sql = ` AND cl.department_id IN (SELECT id FROM departments WHERE school_id = $${idx})`;
    params.push(school_id);
  }
  return [sql, params];
}

function applyExtraFilters(conditions, params, filters) {
  const { school_id, department_id, lecturer_id } = filters;
  if (school_id) {
    params.push(school_id);
    conditions.push(`co.department_id IN (SELECT id FROM departments WHERE school_id = $${params.length})`);
  }
  if (department_id) {
    params.push(department_id);
    conditions.push(`co.department_id = $${params.length}`);
  }
  if (lecturer_id) {
    params.push(lecturer_id);
    conditions.push(`s.session_id IN (SELECT session_id FROM attendance_records) AND s.course_id IN (SELECT course_id FROM course_lecturers WHERE lecturer_id = $${params.length})`);
  }
}

function applyExtraFiltersClass(conditions, params, filters) {
  const { school_id, department_id, lecturer_id } = filters;
  if (school_id) {
    params.push(school_id);
    conditions.push(`cl.department_id IN (SELECT id FROM departments WHERE school_id = $${params.length})`);
  }
  if (department_id) {
    params.push(department_id);
    conditions.push(`cl.department_id = $${params.length}`);
  }
  if (lecturer_id) {
    params.push(lecturer_id);
    conditions.push(`s.session_id IN (SELECT session_id FROM attendance_records) AND s.course_id IN (SELECT course_id FROM course_lecturers WHERE lecturer_id = $${params.length})`);
  }
}

// GET /api/reports/summary — aggregate stats per course and per class
router.get('/summary', async (req, res) => {
  try {
    const { course_code, class_id, school_id, department_id, lecturer_id } = req.query;
    const { level, university_id, school_id: scopeSchoolId, department_id: scopeDeptId } = req.scope;

    const filters = { school_id, department_id, lecturer_id };

    // Per-course summary
    let courseQuery = `
      SELECT
        s.course_id,
        co.course_code,
        co.course_name,
        COUNT(DISTINCT s.session_id)::int AS total_sessions,
        COUNT(DISTINCT ar.index_number)::int AS unique_students,
        COUNT(ar.record_id)::int AS total_checkins
      FROM active_sessions s
      JOIN courses co ON co.id = s.course_id
      LEFT JOIN attendance_records ar ON s.session_id = ar.session_id
      WHERE (s.is_active = FALSE OR s.expires_at < NOW())
    `;
    const courseParams = [];
    if (course_code) {
      courseParams.push(course_code);
      courseQuery += ` AND co.course_code = $${courseParams.length}`;
    }
    let [scopeSql] = scopeCourseFilter(level, scopeSchoolId, scopeDeptId, courseParams);
    courseQuery += scopeSql;
    const extraCourseConds = [];
    applyExtraFilters(extraCourseConds, courseParams, filters);
    extraCourseConds.forEach(c => { courseQuery += ` AND ${c}`; });
    courseQuery += ` GROUP BY s.course_id, co.course_code, co.course_name ORDER BY co.course_name`;

    const courseResult = await pool.query(courseQuery, courseParams);

    // Compute average attendance % per course using roster size
    const coursesWithAvg = await Promise.all(
      courseResult.rows.map(async (row) => {
        const rosterRes = await pool.query(
          `SELECT COUNT(*)::int AS roster_size
           FROM student_roster sr
           WHERE sr.deleted_at IS NULL AND sr.class_id IN (
             SELECT DISTINCT s.class_id FROM active_sessions s WHERE s.course_id = $1
           )`,
          [row.course_id]
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
      LEFT JOIN student_roster sr ON cl.class_id = sr.class_id AND sr.deleted_at IS NULL
      LEFT JOIN active_sessions s ON cl.class_id = s.class_id
        AND (s.is_active = FALSE OR s.expires_at < NOW())
      LEFT JOIN attendance_records ar ON s.session_id = ar.session_id
    `;
    const classParams = [];
    const classConditions = [];
    if (class_id) {
      classParams.push(class_id);
      classConditions.push(`cl.class_id = $${classParams.length}`);
    }
    if (course_code) {
      classParams.push(course_code);
      classConditions.push(`s.course_code = $${classParams.length}`);
    }
    let [classScopeSql, classScopeParams] = scopeClassFilter(level, scopeSchoolId, scopeDeptId, classParams);
    classParams.push(...classScopeParams.slice(classParams.length));
    if (classScopeSql) {
      classConditions.push(classScopeSql.replace(' AND ', ''));
    }
    applyExtraFiltersClass(classConditions, classParams, filters);
    if (classConditions.length > 0) {
      classQuery += ` WHERE ${classConditions.join(' AND ')}`;
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
    const overallParams = [];
    let overallWhere = `WHERE (s.is_active = FALSE OR s.expires_at < NOW())`;
    let [overallScopeSql] = scopeCourseFilter(level, scopeSchoolId, scopeDeptId, overallParams);
    overallWhere += overallScopeSql;
    const overallExtraConds = [];
    applyExtraFilters(overallExtraConds, overallParams, filters);
    overallExtraConds.forEach(c => { overallWhere += ` AND ${c}`; });

    const overallRes = await pool.query(`
      SELECT
        COUNT(DISTINCT s.session_id)::int AS total_sessions,
        COUNT(DISTINCT ar.index_number)::int AS total_students,
        COUNT(ar.record_id)::int AS total_checkins
      FROM active_sessions s
      JOIN courses co ON co.id = s.course_id
      LEFT JOIN attendance_records ar ON s.session_id = ar.session_id
      ${overallWhere}
    `, overallParams);
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

// GET /api/reports/weekly?course_code=&class_id=&school_id=&department_id=&lecturer_id= — per-week breakdown for charts
router.get('/weekly', async (req, res) => {
  try {
    const { course_code, class_id, school_id, department_id, lecturer_id } = req.query;
    const { level, school_id: scopeSchoolId, department_id: scopeDeptId } = req.scope;

    const filters = { school_id, department_id, lecturer_id };

    let query = `
      SELECT
        s.week_number,
        s.course_id,
        co.course_code,
        cl.class_name,
        cl.class_id,
        COUNT(DISTINCT ar.index_number)::int AS attended,
        (SELECT COUNT(*) FROM student_roster WHERE class_id = s.class_id AND deleted_at IS NULL)::int AS total_students
      FROM active_sessions s
      JOIN courses co ON co.id = s.course_id
      JOIN classes cl ON s.class_id = cl.class_id
      LEFT JOIN attendance_records ar ON s.session_id = ar.session_id
      WHERE (s.is_active = FALSE OR s.expires_at < NOW())
    `;
    const params = [];
    const conditions = [];

    if (course_code) {
      params.push(course_code);
      conditions.push(`co.course_code = $${params.length}`);
    }
    if (class_id) {
      params.push(class_id);
      conditions.push(`s.class_id = $${params.length}`);
    }
    let [scopeSql] = scopeCourseFilter(level, scopeSchoolId, scopeDeptId, params);
    if (scopeSql) {
      conditions.push(scopeSql.replace(' AND ', ''));
    }
    applyExtraFilters(conditions, params, filters);
    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }
    query += ` GROUP BY s.week_number, s.course_id, co.course_code, cl.class_name, s.class_id, cl.class_id ORDER BY s.week_number`;

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

// GET /api/reports/export?course_code=&class_id=&school_id=&department_id=&lecturer_id= — CSV download
router.get('/export', async (req, res) => {
  try {
    const { course_code, class_id, school_id, department_id, lecturer_id } = req.query;
    const { level, school_id: scopeSchoolId, department_id: scopeDeptId } = req.scope;

    const filters = { school_id, department_id, lecturer_id };

    let query = `
      SELECT
        co.course_code,
        cl.class_name,
        s.week_number,
        COALESCE(sr.student_name, 'Deleted Student') AS student_name,
        ar.index_number,
        ar.verification_method,
        ar.timestamp
      FROM attendance_records ar
      JOIN active_sessions s ON ar.session_id = s.session_id
      JOIN classes cl ON s.class_id = cl.class_id
      JOIN courses co ON co.id = s.course_id
      LEFT JOIN student_roster sr ON sr.index_number = ar.index_number AND sr.deleted_at IS NULL
      WHERE 1=1
    `;
    const params = [];
    const conditions = [];

    if (course_code) {
      params.push(course_code);
      conditions.push(`co.course_code = $${params.length}`);
    }
    if (class_id) {
      params.push(class_id);
      conditions.push(`s.class_id = $${params.length}`);
    }
    let [scopeSql] = scopeCourseFilter(level, scopeSchoolId, scopeDeptId, params);
    if (scopeSql) {
      conditions.push(scopeSql.replace(' AND ', ''));
    }
    applyExtraFilters(conditions, params, filters);
    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }
    query += ` ORDER BY s.course_code, cl.class_name, s.week_number, sr.student_name`;

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

// GET /api/reports/filters — return available filter options based on scope
router.get('/filters', async (req, res) => {
  try {
    const { level, university_id, school_id, department_id } = req.scope;

    // Schools (university admin only)
    let schools = [];
    if (level === 'university') {
      const r = await pool.query('SELECT id, name FROM schools WHERE university_id = $1 AND deleted_at IS NULL ORDER BY name', [university_id]);
      schools = r.rows;
    }

    // Departments (university + school admin)
    let departments = [];
    if (level === 'university') {
      const r = await pool.query(
        `SELECT d.id, d.name, d.school_id FROM departments d
         JOIN schools s ON s.id = d.school_id
         WHERE s.university_id = $1 AND d.deleted_at IS NULL ORDER BY d.name`, [university_id]
      );
      departments = r.rows;
    } else if (level === 'school') {
      const r = await pool.query('SELECT id, name FROM departments WHERE school_id = $1 AND deleted_at IS NULL ORDER BY name', [school_id]);
      departments = r.rows;
    }

    // Courses (scoped)
    let courseSql = 'SELECT course_code, course_name, department_id FROM courses WHERE deleted_at IS NULL';
    let classSql = 'SELECT class_id, class_name, department_id FROM classes WHERE deleted_at IS NULL';
    let lecturerSql = `SELECT l.id, l.name, l.department_id FROM lecturers l WHERE l.deleted_at IS NULL`;
    const courseParams = [];
    const classParams = [];
    const lecturerParams = [];

    if (level === 'department') {
      courseSql += ` AND department_id = $1`;
      courseParams.push(department_id);
      classSql += ` AND department_id = $1`;
      classParams.push(department_id);
      lecturerSql += ` AND l.department_id = $1`;
      lecturerParams.push(department_id);
    } else if (level === 'school') {
      courseSql += ` AND department_id IN (SELECT id FROM departments WHERE school_id = $1)`;
      courseParams.push(school_id);
      classSql += ` AND department_id IN (SELECT id FROM departments WHERE school_id = $1)`;
      classParams.push(school_id);
      lecturerSql += ` AND l.department_id IN (SELECT id FROM departments WHERE school_id = $1)`;
      lecturerParams.push(school_id);
    } else if (level === 'university') {
      lecturerSql += ` AND l.department_id IN (SELECT d.id FROM departments d JOIN schools s ON s.id = d.school_id WHERE s.university_id = $1)`;
      lecturerParams.push(university_id);
    }

    courseSql += ' ORDER BY course_name';
    classSql += ' ORDER BY class_name';
    lecturerSql += ' ORDER BY l.name';

    const [coursesRes, classesRes, lecturersRes] = await Promise.all([
      pool.query(courseSql, courseParams),
      pool.query(classSql, classParams),
      pool.query(lecturerSql, lecturerParams),
    ]);

    res.json({
      schools,
      departments,
      courses: coursesRes.rows,
      classes: classesRes.rows,
      lecturers: lecturersRes.rows,
    });
  } catch (err) {
    console.error('Report filters error:', err);
    res.status(500).json({ error: "Couldn't load the report filters. Try again." });
  }
});

module.exports = router;
