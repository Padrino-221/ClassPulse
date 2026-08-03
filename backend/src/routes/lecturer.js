const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { getCurrentPin, generateSeed, staticPinFromSeed } = require('../services/pin');
const { verifyToken } = require('../middleware/auth');
const sessionCache = require('../services/sessionCache');

const router = express.Router();
router.use(verifyToken('lecturer'));

router.post(
  '/activate',
  [
    body('course_code').isString().trim().notEmpty().withMessage('Enter a course code.'),
    body('class_ids').isArray({ min: 1 }).withMessage('Select at least one class.'),
    body('class_ids.*').isInt({ min: 1 }),
    body('week_number').isInt({ min: 1 }).withMessage('Enter a valid week number.'),
    body('lecture_hall_id').isInt({ min: 1 }).withMessage('Select a lecture hall.'),
    body('pin_spinning').optional().isBoolean(),
    body('duration_minutes').isInt({ min: 1, max: 480 }).withMessage('Enter a valid duration in minutes.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { course_code, class_ids, week_number, lecture_hall_id, pin_spinning, duration_minutes } = req.body;
    const lecturerId = req.user.id;
    const duration = duration_minutes || 120;
    const spinning = pin_spinning !== false;

    try {
    const lectureHall = sessionCache.getLectureHall(lecture_hall_id);
    if (!lectureHall) {
      return res.status(404).json({ error: 'Lecture Hall not found.' });
      }

      const activeSemester = sessionCache.activeSemester;
      if (!activeSemester) {
        return res.status(400).json({ error: 'No active semester. Ask admin to activate a semester first.' });
      }

      const courseCheck = await pool.query(
        'SELECT id, total_weeks, course_name FROM courses WHERE course_code = $1',
        [course_code]
      );

      if (courseCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Course not found.' });
      }

      const courseName = courseCheck.rows[0].course_name;
      const courseId = courseCheck.rows[0].id;

      const client = await pool.connect();
      const created = [];
      try {
        await client.query('BEGIN');

        for (const classId of class_ids) {
          // Prevent duplicate week: one session per course + class + week
          const duplicate = await client.query(
            `SELECT session_id FROM active_sessions
             WHERE course_id = $1 AND class_id = $2 AND week_number = $3
             FOR UPDATE`,
            [courseId, classId, week_number]
          );
          if (duplicate.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `A session for ${course_code}, week ${week_number} already exists. End it first or choose a different week.` });
          }
          const pinSeed = generateSeed();
          const staticPin = spinning ? null : staticPinFromSeed(pinSeed);

          const result = await client.query(
            `INSERT INTO active_sessions (
               course_id, course_code, class_id, lecturer_id, week_number, pin_seed,
               pin_spinning, lecture_hall_id, semester_id, expires_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '1 minute' * $10)
             RETURNING session_id, pin_seed, created_at, expires_at`,
            [
              courseId,
              course_code,
              classId,
              lecturerId,
              week_number,
              pinSeed,
              spinning,
              lecture_hall_id,
              activeSemester.id,
              duration,
            ]
          );

          const session = result.rows[0];

          sessionCache.set({
            session_id: session.session_id,
            pin_seed: session.pin_seed,
            static_pin: staticPin,
            pin_spinning: spinning,
            course_code,
            course_name: courseName,
            class_id: classId,
            week_number,
            is_active: true,
            lecture_hall_id: lectureHall.id,
            expires_at: session.expires_at,
          });

          created.push({
            session_id: session.session_id,
            pin: staticPin || getCurrentPin(pinSeed),
            pin_spinning: spinning,
            course_code,
            class_id: classId,
            lecture_hall: lectureHall.name,
            created_at: session.created_at,
            expires_at: session.expires_at,
          });
        }

        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }

      res.status(201).json({
        message: `${created.length} session(s) started.`,
        sessions: created,
      });
    } catch (err) {
      console.error('Activate session error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

// ---- POST /schedule ----
// Pre-create a session for a specific date/time. It stays inactive until the cron activates it.
router.post(
  '/schedule',
  [
    body('course_code').isString().trim().notEmpty().withMessage('Enter a course code.'),
    body('class_ids').isArray({ min: 1 }).withMessage('Select at least one class.'),
    body('class_ids.*').isInt({ min: 1 }),
    body('scheduled_date').isString().notEmpty().withMessage('Enter a date and time.'),
    body('duration_minutes').isInt({ min: 1, max: 480 }).withMessage('Enter a valid duration in minutes.'),
    body('week_number').isInt({ min: 1, max: 52 }).withMessage('Enter a valid week number.'),
    body('lecture_hall_id').isInt({ min: 1 }).withMessage('Select a lecture hall.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      course_code, class_ids, scheduled_date, duration_minutes, week_number, lecture_hall_id,
    } = req.body;
    const lecturerId = req.user.id;

    try {
      const lectureHall = sessionCache.getLectureHall(lecture_hall_id);
      if (!lectureHall) {
        return res.status(404).json({ error: 'Lecture Hall not found.' });
      }

      const activeSemester = sessionCache.activeSemester;
      if (!activeSemester) {
        return res.status(400).json({ error: 'No active semester. Ask admin to activate a semester first.' });
      }

      const courseCheck = await pool.query(
        'SELECT id, total_weeks FROM courses WHERE course_code = $1',
        [course_code]
      );
      if (courseCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Course not found.' });
      }
      const courseId = courseCheck.rows[0].id;

      const sessionDate = new Date(scheduled_date);
      if (isNaN(sessionDate.getTime())) {
        return res.status(400).json({ error: 'Invalid scheduled date.' });
      }
      if (sessionDate < new Date()) {
        return res.status(400).json({ error: 'Scheduled date must be in the future.' });
      }

      const expiresAt = new Date(sessionDate.getTime() + duration_minutes * 60 * 1000);

      const client = await pool.connect();
      const created = [];
      try {
        await client.query('BEGIN');

        for (const classId of class_ids) {
          const duplicate = await client.query(
            `SELECT session_id FROM active_sessions
             WHERE course_id = $1 AND class_id = $2 AND week_number = $3
             FOR UPDATE`,
            [courseId, classId, week_number]
          );
          if (duplicate.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
              error: `Session for ${course_code}, week ${week_number} already exists. Cancel it first.`,
            });
          }

          const pinSeed = generateSeed();
          const result = await client.query(
            `INSERT INTO active_sessions (
               course_id, course_code, class_id, lecturer_id, week_number, pin_seed,
               pin_spinning, lecture_hall_id,
               semester_id, scheduled_at, expires_at, is_active
             )
             VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, $8, $9::timestamptz, $9::timestamptz + INTERVAL '1 minute' * $10, FALSE)
             RETURNING session_id, created_at, expires_at`,
            [
              courseId, course_code, classId, lecturerId, week_number, pinSeed,
              lecture_hall_id,
              activeSemester.id, scheduled_date, duration_minutes,
            ]
          );

          created.push({
            session_id: result.rows[0].session_id,
            course_code,
            class_id: classId,
            week_number: week_number,
            scheduled_date: scheduled_date,
            expires_at: result.rows[0].expires_at,
          });
        }

        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }

      res.status(201).json({
        message: `${created.length} session(s) scheduled for ${sessionDate.toLocaleString()}.`,
        sessions: created,
      });
    } catch (err) {
      console.error('Schedule session error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

// ---- GET /scheduled ----
// List scheduled (inactive) sessions for the current lecturer.
router.get('/scheduled', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.session_id, s.course_code, s.class_id, s.week_number,
              s.scheduled_at, s.expires_at, s.pin_spinning, s.pin_seed,
              c.course_name, cl.class_name, lh.name AS lecture_hall_name
       FROM active_sessions s
       JOIN courses c ON c.id = s.course_id AND c.deleted_at IS NULL
       JOIN classes cl ON cl.class_id = s.class_id AND cl.deleted_at IS NULL
       LEFT JOIN lecture_halls lh ON lh.id = s.lecture_hall_id AND lh.deleted_at IS NULL
       WHERE s.lecturer_id = $1
         AND s.is_active = FALSE
         AND s.scheduled_at IS NOT NULL
         AND s.scheduled_at > NOW()
       ORDER BY s.expires_at ASC`,
      [req.user.id]
    );
    const rows = result.rows.map((r) => {
      const isSpinning = r.pin_spinning !== false;
      const pin = isSpinning ? null : staticPinFromSeed(r.pin_seed);
      return { ...r, pin: pin ? `${r.course_code}-${pin}` : null };
    });
    res.json(rows);
  } catch (err) {
    console.error('List scheduled sessions error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ---- DELETE /scheduled/:id ----
// Cancel a scheduled (inactive) session before it activates.
router.delete('/scheduled/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM active_sessions
       WHERE session_id = $1 AND lecturer_id = $2 AND is_active = FALSE AND scheduled_at IS NOT NULL
       RETURNING session_id`,
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scheduled session not found or already active.' });
    }
    res.json({ message: 'Scheduled session cancelled.', session_id: id });
  } catch (err) {
    console.error('Cancel scheduled session error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post('/deactivate/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE active_sessions SET is_active = FALSE, expires_at = NOW(), scheduled_at = NULL
       WHERE session_id = $1 AND lecturer_id = $2
       RETURNING session_id, course_code, class_id`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found or has ended.' });
    }

    // Invalidate cache
    sessionCache.markInactive(id);
    const row = result.rows[0];
    sessionCache.invalidateMatricesForCourse(row.course_code, row.class_id);

    res.json({ message: 'Session ended.', session_id: id });
  } catch (err) {
    console.error('Deactivate session error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ---- GET /courses/:code/classes ----
// Return only classes that have sessions for the given course under this lecturer.
router.get('/courses/:code/classes', async (req, res) => {
  const { code } = req.params;
  try {
    const result = await pool.query(
      `SELECT DISTINCT cl.class_id, cl.class_name
       FROM active_sessions s
       JOIN classes cl ON cl.class_id = s.class_id AND cl.deleted_at IS NULL
       JOIN courses c ON c.id = s.course_id AND c.deleted_at IS NULL
       WHERE c.course_code = $1
         AND s.lecturer_id = $2
       ORDER BY cl.class_name`,
      [code, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get course classes error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.get('/session/:id/live', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT ar.record_id, ar.index_number, COALESCE(sr.student_name, 'Deleted Student') AS student_name, ar.verification_method, ar.timestamp
       FROM attendance_records ar
       LEFT JOIN student_roster sr ON sr.index_number = ar.index_number AND sr.deleted_at IS NULL
       WHERE ar.session_id = $1
       ORDER BY ar.timestamp DESC`,
      [id]
    );

    res.json({ records: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('Live tracker error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.get('/sessions', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const count = await pool.query('SELECT COUNT(*) FROM active_sessions WHERE lecturer_id = $1', [req.user.id]);
    const result = await pool.query(
      `SELECT as2.session_id, c.course_code, c.course_name, cl.class_name,
              as2.week_number, as2.pin_seed, as2.pin_spinning,
              as2.created_at, as2.expires_at, as2.is_active,
              (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = as2.session_id) AS attendance_count
       FROM active_sessions as2
       JOIN courses c ON c.id = as2.course_id AND c.deleted_at IS NULL
       JOIN classes cl ON cl.class_id = as2.class_id AND cl.deleted_at IS NULL
       WHERE as2.lecturer_id = $1
       ORDER BY as2.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    const rows = result.rows.map((s) => {
      let currentPin = null;
      if (s.is_active && s.pin_seed) {
        currentPin = s.pin_spinning !== false
          ? getCurrentPin(s.pin_seed)
          : staticPinFromSeed(s.pin_seed);
      }
      const { pin_seed: _, ...rest } = s;
      return { ...rest, pin: currentPin };
    });

    res.json({ sessions: rows, total: parseInt(count.rows[0].count) });
  } catch (err) {
    console.error('List sessions error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.get('/history', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
}, async (req, res) => {
  const { course_code, class_id } = req.query;

  if (!course_code || !class_id) {
    return res.status(400).json({ error: 'Course and class required.' });
  }

  const cacheKey = `${course_code}:${class_id}`;
  const cached = sessionCache.getMatrix(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    // Verify the course and class belong to this lecturer
    const course = await pool.query(
      `SELECT c.id, c.total_weeks, c.min_attendance_pct FROM courses c
       JOIN course_lecturers cl ON cl.course_id = c.id AND cl.lecturer_id = $2
       WHERE c.course_code = $1 AND c.deleted_at IS NULL`,
      [course_code, req.user.id]
    );
    if (course.rows.length === 0) {
      return res.status(403).json({ error: 'Course not found.' });
    }

    const classCheck = await pool.query(
      'SELECT 1 FROM class_lecturers WHERE class_id = $1 AND lecturer_id = $2',
      [class_id, req.user.id]
    );
    if (classCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Class not found.' });
    }

    const minPct = course.rows[0].min_attendance_pct;
    const courseId = course.rows[0].id;

    const students = await pool.query(
      'SELECT id, index_number, student_name FROM student_roster WHERE class_id = $1 ORDER BY student_name',
      [class_id]
    );

    if (students.rows.length === 0) {
      const empty = { students: [], weeks: [], matrix: {}, percentages: {} };
      return res.json(empty);
    }

    const totalWeeks = course.rows[0].total_weeks;

    // Optimized single-query pivot using CASE WHEN
    const attendanceData = await pool.query(
      `SELECT
         sr.id AS student_id,
         sr.index_number,
         weeks.week_number,
         MAX(CASE WHEN ar.record_id IS NOT NULL THEN 1 ELSE 0 END) AS attended
       FROM student_roster sr
       CROSS JOIN (
         SELECT generate_series(1, $1) AS week_number
       ) weeks
       LEFT JOIN active_sessions as2
         ON as2.course_id = $2 AND as2.class_id = $3 AND as2.week_number = weeks.week_number
       LEFT JOIN attendance_records ar
         ON ar.session_id = as2.session_id AND ar.index_number = sr.index_number
       WHERE sr.class_id = $3
       GROUP BY sr.id, sr.index_number, weeks.week_number
       ORDER BY sr.student_name, weeks.week_number`,
      [totalWeeks, courseId, class_id]
    );

    // Build matrix from flat result
    const matrix = {};
    const percentages = {};
    const sessionWeeksSet = new Set();

    const activeWeeksResult = await pool.query(
      'SELECT DISTINCT week_number FROM active_sessions WHERE course_id = $1 AND class_id = $2 ORDER BY week_number',
      [courseId, class_id]
    );
    const sessionWeeks = activeWeeksResult.rows.map(r => r.week_number);
    sessionWeeks.forEach(w => sessionWeeksSet.add(w));

    for (const row of attendanceData.rows) {
      if (!matrix[row.student_id]) {
        matrix[row.student_id] = {};
        percentages[row.student_id] = 0;
      }
    }

    // Build per-student row state and count
    for (const row of attendanceData.rows) {
      const week = row.week_number;
      if (!sessionWeeksSet.has(week)) {
        matrix[row.student_id][week] = 'future';
      } else if (row.attended) {
        matrix[row.student_id][week] = 'present';
      } else {
        matrix[row.student_id][week] = 'absent';
      }
    }

    // Compute percentages
    for (const student of students.rows) {
      let presentCount = 0;
      for (const week of sessionWeeks) {
        if (matrix[student.id]?.[week] === 'present') presentCount++;
      }
      percentages[student.id] = sessionWeeks.length > 0
        ? Math.round((presentCount / sessionWeeks.length) * 100)
        : 0;
    }

    const atRisk = {};
    for (const student of students.rows) {
      atRisk[student.id] = (percentages[student.id] || 0) < minPct;
    }

    const result = {
      students: students.rows,
      weeks: Array.from({ length: totalWeeks }, (_, i) => i + 1),
      active_weeks: sessionWeeks,
      matrix,
      percentages,
      at_risk: atRisk,
      min_attendance_pct: minPct,
    };

    sessionCache.setMatrix(cacheKey, result);

    res.json(result);
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.get('/history/export', async (req, res) => {
  const { course_code, class_id } = req.query;

  if (!course_code || !class_id) {
    return res.status(400).json({ error: 'Course and class required.' });
  }

  try {
    const [studentsRes, courseRes, classRes, sessionsRes, lecturerRes, semesterRes, hierarchyRes] = await Promise.all([
      pool.query('SELECT id, index_number, student_name FROM student_roster WHERE class_id = $1 ORDER BY student_name', [class_id]),
      pool.query(`SELECT c.course_code, c.course_name, c.total_weeks, c.department_id FROM courses c
        JOIN course_lecturers cl ON cl.course_id = c.id AND cl.lecturer_id = $2
        WHERE c.course_code = $1`, [course_code, req.user.id]),
      pool.query('SELECT class_name FROM classes WHERE class_id = $1', [class_id]),
      pool.query(`SELECT s.session_id, s.week_number
        FROM active_sessions s
        JOIN courses c ON c.id = s.course_id
        WHERE c.course_code = $1 AND s.class_id = $2 ORDER BY s.week_number`, [course_code, class_id]),
      pool.query('SELECT name FROM lecturers WHERE id = $1', [req.user.id]),
      pool.query(`SELECT sem.label AS semester_label, ay.label AS year_label
        FROM active_sessions s
        JOIN courses c ON c.id = s.course_id
        JOIN semesters sem ON sem.id = s.semester_id
        JOIN academic_years ay ON ay.id = sem.academic_year_id
        WHERE c.course_code = $1 AND s.class_id = $2 AND s.semester_id IS NOT NULL
        LIMIT 1`, [course_code, class_id]),
      pool.query(`SELECT d.name AS dept_name, sc.name AS school_name
        FROM courses c
        LEFT JOIN departments d ON d.id = c.department_id
        LEFT JOIN schools sc ON sc.id = d.school_id
        WHERE c.course_code = $1`, [course_code]),
    ]);

    const students = studentsRes.rows;
    const course = courseRes.rows[0];
    const classInfo = classRes.rows[0];

    if (!course) {
      return res.status(403).json({ error: 'Course not found.' });
    }

    if (!classInfo) {
      return res.status(403).json({ error: 'Class not found.' });
    }

    const totalWeeks = course.total_weeks;
    const sessionWeeks = sessionsRes.rows.map(s => s.week_number);
    const sessionIds = sessionsRes.rows.map(s => s.session_id);

    let attendanceMap = {};
    if (sessionIds.length > 0) {
      const attendance = await pool.query(
        `SELECT ar.index_number, as2.week_number
         FROM attendance_records ar
         JOIN active_sessions as2 ON as2.session_id = ar.session_id
         WHERE ar.session_id = ANY($1::uuid[])`,
        [sessionIds]
      );

      for (const row of attendance.rows) {
        if (!attendanceMap[row.index_number]) {
          attendanceMap[row.index_number] = new Set();
        }
        attendanceMap[row.index_number].add(row.week_number);
      }
    }

    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ClassPulse';
    wb.created = new Date();
    const ws = wb.addWorksheet('Attendance');

    const green = 'FF00B66E';
    const lightGreen = 'FFE6F9F0';
    const lightRed = 'FFFEF2F2';
    const lightGray = 'FFF4F7F6';
    const white = 'FFFFFFFF';
    const border = 'FFE2E8F0';
    const darkText = 'FF2D3748';

    const lecturerName = lecturerRes.rows[0]?.name || '';
    const semInfo = semesterRes.rows[0];
    const semesterLabel = semInfo ? `${semInfo.year_label} - ${semInfo.semester_label}` : '';
    const hierarchy = hierarchyRes.rows[0];
    const deptName = hierarchy?.dept_name || '';
    const schoolName = hierarchy?.school_name || '';
    const orgLine = [schoolName, deptName].filter(Boolean).join(' - ') || '';

    // Column widths
    ws.getColumn(1).width = 22;
    ws.getColumn(2).width = 28;
    for (let i = 3; i <= 3 + totalWeeks; i++) {
      ws.getColumn(i).width = 10;
    }
    const pctCol = 3 + totalWeeks;
    ws.getColumn(pctCol).width = 14;

    // --- Boilerplate header rows (rows 1-4) ---
    // Row 1: University name
    const uniRow = ws.getRow(1);
    uniRow.height = 28;
    const uniCell = uniRow.getCell(1);
    uniCell.value = 'ClassPulse University';
    uniCell.font = { bold: true, size: 14, color: { argb: 'FF2563EB' }, name: 'Calibri' };
    uniCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(1, 1, 1, pctCol);

    // Row 2: School - Department (placeholder)
    const deptRow = ws.getRow(2);
    deptRow.height = 22;
    const deptCell = deptRow.getCell(1);
    deptCell.value = orgLine;
    deptCell.font = { bold: true, size: 11, color: { argb: darkText }, name: 'Calibri' };
    deptCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(2, 1, 2, pctCol);

    // Row 3: Lecturer - Semester - Course - Weeks - Active
    const infoRow = ws.getRow(3);
    infoRow.height = 20;
    const infoParts = [lecturerName, semesterLabel, `${course.course_code} - ${course.course_name}`, `Weeks: ${totalWeeks}`, `Active: ${sessionWeeks.length}`].filter(Boolean);
    const infoCell = infoRow.getCell(1);
    infoCell.value = infoParts.join('  |  ');
    infoCell.font = { size: 10, color: { argb: darkText }, name: 'Calibri' };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(3, 1, 3, pctCol);

    // Row 4: Blank separator
    ws.getRow(4).height = 8;

    // --- Metadata row (now row 5) ---
    const metaRow = ws.getRow(5);
    metaRow.height = 26;
    const metaColors = ['FF2563EB', 'FF7C3AED', 'FF00B66E', 'FFDC2626'];
    const metaPairs = [
      { label: 'Course', value: `${course.course_code} - ${course.course_name}` },
      { label: 'Class', value: classInfo.class_name },
      { label: 'Weeks', value: totalWeeks },
      { label: 'Active', value: sessionWeeks.length },
    ];
    metaPairs.forEach((pair, i) => {
      const cell = metaRow.getCell(i + 1);
      cell.value = `${pair.label}: ${pair.value}`;
      cell.font = { bold: true, size: 10, color: { argb: darkText } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: border } },
        left: { style: 'thin', color: { argb: border } },
        bottom: { style: 'thin', color: { argb: border } },
        right: { style: 'thin', color: { argb: border } },
      };
    });

    // Header row (now row 6)
    const headerRow = ws.getRow(6);
    headerRow.height = 28;
    const headers = ['Index Number', 'Student Name'];
    for (let w = 1; w <= totalWeeks; w++) headers.push(`W${w}`);
    headers.push('Attendance %');

    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: white }, size: 11, name: 'Calibri' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: green } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: border } },
        left: { style: 'thin', color: { argb: border } },
        bottom: { style: 'thin', color: { argb: border } },
        right: { style: 'thin', color: { argb: border } },
      };
    });

    // Data rows (start at row 7)
    students.forEach((student, idx) => {
      const rowNum = idx + 7;
      const row = ws.getRow(rowNum);
      row.height = 22;

      row.getCell(1).value = student.index_number;
      row.getCell(1).font = { size: 10, color: { argb: darkText } };
      row.getCell(2).value = student.student_name;
      row.getCell(2).font = { size: 10, color: { argb: darkText } };

      let presentCount = 0;
      for (let w = 1; w <= totalWeeks; w++) {
        const cell = row.getCell(w + 2);
        if (!sessionWeeks.includes(w)) {
          cell.value = '-';
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGray } };
          cell.font = { color: { argb: 'FFA0AEC0' }, size: 10 };
        } else if (attendanceMap[student.index_number]?.has(w)) {
          cell.value = 'P';
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } };
          cell.font = { bold: true, color: { argb: green }, size: 10 };
          presentCount++;
        } else {
          cell.value = 'A';
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightRed } };
          cell.font = { bold: true, color: { argb: 'FFDC2626' }, size: 10 };
        }
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: border } },
          left: { style: 'thin', color: { argb: border } },
          bottom: { style: 'thin', color: { argb: border } },
          right: { style: 'thin', color: { argb: border } },
        };
      }

      const pct = sessionWeeks.length > 0 ? Math.round((presentCount / sessionWeeks.length) * 100) : 0;
      const pctCell = row.getCell(pctCol);
      pctCell.value = `${pct}%`;
      pctCell.alignment = { horizontal: 'center', vertical: 'middle' };
      pctCell.font = { bold: true, size: 10, color: { argb: pct >= 50 ? green : 'FFDC2626' } };
      pctCell.border = {
        top: { style: 'thin', color: { argb: border } },
        left: { style: 'thin', color: { argb: border } },
        bottom: { style: 'thin', color: { argb: border } },
        right: { style: 'thin', color: { argb: border } },
      };
    });

    // Summary footer row
    const footerRow = ws.getRow(students.length + 7);
    footerRow.getCell(1).value = 'Week Active';
    footerRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF718096' } };
    for (let w = 1; w <= totalWeeks; w++) {
      const cell = footerRow.getCell(w + 2);
      cell.value = sessionWeeks.includes(w) ? 'Yes' : 'No';
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = { size: 9, color: { argb: 'FF718096' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGray } };
    }

    // Freeze pane below header
    ws.views = [{ state: 'frozen', ySplit: 6, xSplit: 2 }];

    const buf = await wb.xlsx.writeBuffer();
    const fileName = `attendance_${course_code}_${class_id}.xlsx`.replace(/[^a-zA-Z0-9_.-]/g, '_');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buf);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.get('/session/:id/pin', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT pin_seed, pin_spinning, course_code, class_id, is_active, expires_at
       FROM active_sessions WHERE session_id = $1 AND lecturer_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found or has ended.' });
    }

    const s = result.rows[0];
    if (!s.is_active) {
      return res.json({ active: false, pin: null, expiresIn: 0, pin_spinning: s.pin_spinning });
    }

    const isSpinning = s.pin_spinning !== false;

    let pin;
    if (isSpinning) {
      pin = getCurrentPin(s.pin_seed);
    } else {
      const cached = sessionCache.get(id);
      pin = cached?.static_pin || staticPinFromSeed(s.pin_seed);
    }
    const formattedPin = `${s.course_code}-${pin}`;

    let expiresIn;
    if (isSpinning) {
      const now = Date.now();
      const stepMs = 60 * 1000;
      const nextRefresh = Math.ceil(now / stepMs) * stepMs;
      expiresIn = Math.max(0, nextRefresh - now);
    } else {
      expiresIn = null;
    }

    res.json({
      active: true,
      pin: formattedPin,
      expiresIn,
      pin_spinning: isSpinning,
      sessionExpiresAt: s.expires_at,
    });
  } catch (err) {
    console.error('PIN tick error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.get('/lecture-halls', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, latitude, longitude, radius FROM lecture_halls WHERE deleted_at IS NULL ORDER BY name');
    res.json({ lecture_halls: result.rows });
  } catch (err) {
    console.error('List lecture halls error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.get('/courses', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.* FROM courses c
       JOIN course_lecturers cl ON cl.course_id = c.id AND cl.lecturer_id = $1
       WHERE c.deleted_at IS NULL
       ORDER BY c.course_name`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      const check = await pool.query('SELECT COUNT(*) FROM course_lecturers WHERE lecturer_id = $1', [req.user.id]);
      console.log(`[lecturer/courses] lecturer_id=${req.user.id} → 0 courses, junction_rows=${check.rows[0].count}`);
    }
    res.json({ courses: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.get('/classes', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, (SELECT COUNT(*) FROM student_roster sr WHERE sr.class_id = c.class_id) AS student_count
       FROM classes c
       JOIN class_lecturers cl ON cl.class_id = c.class_id AND cl.lecturer_id = $1
       WHERE c.deleted_at IS NULL
       ORDER BY c.class_name`,
      [req.user.id]
    );
    res.json({ classes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
