const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { verifyToken, verifyScope } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../services/mailer');
const { auditLog } = require('../middleware/auditLog');
const { importStudentRoster, importLecturers } = require('../services/bulkImport');

const router = express.Router();
router.use(verifyToken('admin'));
router.use(verifyScope());

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// University admins are system owners — they manage structure, not day-to-day data.
function denyUniversityAdmin(req, res) {
  if (req.scope.level === 'university') {
    return res.status(403).json({ error: 'University admins cannot manage this resource. Use school or department admins.' });
  }
  return false;
}

// ── Lecturers ──

router.get('/lecturers', async (req, res) => {
  try {
    const { level, university_id, school_id, department_id } = req.scope;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    let whereClause = 'WHERE l.deleted_at IS NULL';
    let params = [];
    let idx = 1;

    if (level === 'department') {
      whereClause += ` AND l.department_id = $${idx++}`;
      params.push(department_id);
    } else if (level === 'school') {
      whereClause += ` AND l.department_id IN (SELECT id FROM departments WHERE school_id = $${idx++})`;
      params.push(school_id);
      if (req.query.department_id) {
        whereClause += ` AND l.department_id = $${idx++}`;
        params.push(req.query.department_id);
      }
    } else if (level === 'university') {
      if (req.query.school_id) {
        whereClause += ` AND l.department_id IN (SELECT id FROM departments WHERE school_id = $${idx++})`;
        params.push(req.query.school_id);
      }
      if (req.query.department_id) {
        whereClause += ` AND l.department_id = $${idx++}`;
        params.push(req.query.department_id);
      }
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM lecturers l ${whereClause}`, params);
    const count = parseInt(countResult.rows[0].count);

    const qParams = [...params, limit, offset];
    const result = await pool.query(
      `SELECT l.id, l.name, l.email, l.created_at, d.name AS department_name
       FROM lecturers l
       LEFT JOIN departments d ON d.id = l.department_id
       ${whereClause}
       ORDER BY l.name
       LIMIT $${idx++} OFFSET $${idx++}`,
      qParams
    );
    res.json({ lecturers: result.rows, total: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post(
  '/lecturers',
  auditLog('create', 'lecturer'),
  [
    body('name').isString().trim().isLength({ min: 1, max: 255 }).notEmpty(),
    body('email').isEmail().normalizeEmail().isLength({ max: 255 }),
    body('password').isString().isLength({ min: 8, max: 128 }),
  ],
  handleValidation,
  async (req, res) => {
    if (denyUniversityAdmin(req, res)) return;
    const { name, email, password } = req.body;
    const { level, department_id: scopeDeptId } = req.scope;
    // Department admin auto-sets department_id
    const departmentId = level === 'department' ? scopeDeptId : (req.body.department_id || null);
    try {
      const hash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        'INSERT INTO lecturers (name, email, password_hash, department_id) VALUES ($1, $2, $3, $4) RETURNING id, name, email, created_at',
        [name, email, hash, departmentId]
      );

      // Generate reset token (fire-and-forget, don't block response)
      const resetToken = crypto.randomBytes(32).toString('hex');
      const userId = result.rows[0].id;
      pool.query(
        'INSERT INTO password_reset_tokens (user_type, user_id, token) VALUES ($1, $2, $3)',
        ['lecturer', userId, resetToken]
      ).then(() => sendWelcomeEmail(email, name, email, resetToken)).catch(err => {
        console.error('Welcome email failed:', err.message);
      });

      res.status(201).json({ lecturer: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'An account with this email already exists.' });
      console.error(err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

// ── CSV Bulk Import Lecturers (department admins) ──
router.post(
  '/lecturers/bulk',
  auditLog('create', 'lecturer'),
  upload.single('file'),
  async (req, res) => {
    if (denyUniversityAdmin(req, res)) return;
    try {
      if (!req.file) return res.status(400).json({ error: 'CSV file needed.' });
      if (req.scope.level !== 'department') {
        return res.status(403).json({ error: 'Only department admins can bulk-import lecturers.' });
      }
      const result = await importLecturers(pool, req.file.buffer.toString('utf-8'), req.scope.department_id);
      if (result.error) return res.status(400).json({ error: result.error });
      res.status(201).json({ added: result.added.length, skipped: result.skipped, errors: result.errors, lecturers: result.added });
    } catch (err) {
      console.error('Bulk lecturer import error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

router.put(
  '/lecturers/:id',
  [
    body('name').isString().trim().isLength({ min: 1, max: 255 }).notEmpty(),
    body('email').isEmail().normalizeEmail().isLength({ max: 255 }),
    body('password').optional().isString().isLength({ min: 8, max: 128 }),
  ],
  handleValidation,
  async (req, res) => {
    if (denyUniversityAdmin(req, res)) return;
    const { name, email } = req.body;
    try {
      let query, params;
      if (req.body.password) {
        const hash = await bcrypt.hash(req.body.password, 10);
        query = 'UPDATE lecturers SET name = $1, email = $2, password_hash = $3 WHERE id = $4 RETURNING id, name, email, created_at';
        params = [name, email, hash, req.params.id];
      } else {
        query = 'UPDATE lecturers SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email, created_at';
        params = [name, email, req.params.id];
      }
      const result = await pool.query(query, params);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Lecturer not found.' });
      res.json({ lecturer: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'An account with this email already exists.' });
      console.error(err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

router.delete('/lecturers/:id', auditLog('delete', 'lecturer'), async (req, res) => {
  if (denyUniversityAdmin(req, res)) return;
  try {
    await pool.query('UPDATE lecturers SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    res.json({ message: 'Lecturer deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.delete('/lecturers', auditLog('delete', 'lecturer'), async (req, res) => {
  if (denyUniversityAdmin(req, res)) return;
  try {
    const { level, school_id, department_id } = req.scope;
    let whereClause = 'deleted_at IS NULL';
    const params = [];
    let idx = 1;
    if (level === 'department') {
      whereClause += ` AND department_id = $${idx++}`;
      params.push(department_id);
    } else if (level === 'school') {
      whereClause += ` AND department_id IN (SELECT id FROM departments WHERE school_id = $${idx++})`;
      params.push(school_id);
      if (req.query.department_id) {
        whereClause += ` AND department_id = $${idx++}`;
        params.push(req.query.department_id);
      }
    }
    const result = await pool.query(`UPDATE lecturers SET deleted_at = NOW() WHERE ${whereClause} RETURNING id`, params);
    res.json({ message: `${result.rowCount} lecturer(s) deleted.`, count: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── Courses ──

router.get('/courses', async (req, res) => {
  try {
    const { level, university_id, school_id, department_id } = req.scope;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    let whereClause = 'WHERE c.deleted_at IS NULL';
    let params = [];
    let idx = 1;

    if (level === 'department') {
      whereClause += ` AND c.department_id = $${idx++}`;
      params.push(department_id);
    } else if (level === 'school') {
      whereClause += ` AND c.department_id IN (SELECT id FROM departments WHERE school_id = $${idx++})`;
      params.push(school_id);
      if (req.query.department_id) {
        whereClause += ` AND c.department_id = $${idx++}`;
        params.push(req.query.department_id);
      }
    } else if (level === 'university') {
      if (req.query.school_id) {
        whereClause += ` AND c.department_id IN (SELECT id FROM departments WHERE school_id = $${idx++})`;
        params.push(req.query.school_id);
      }
      if (req.query.department_id) {
        whereClause += ` AND c.department_id = $${idx++}`;
        params.push(req.query.department_id);
      }
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM courses c ${whereClause}`, params);
    const count = parseInt(countResult.rows[0].count);

    const qParams = [...params, limit, offset];
    const result = await pool.query(
      `SELECT c.*,
              COALESCE(json_agg(json_build_object('id', l.id, 'name', l.name))
                FILTER (WHERE l.id IS NOT NULL), '[]') AS lecturers
       FROM courses c
       LEFT JOIN course_lecturers cl ON cl.course_id = c.id
       LEFT JOIN lecturers l ON l.id = cl.lecturer_id
       ${whereClause}
       GROUP BY c.id
       ORDER BY c.course_name
       LIMIT $${idx++} OFFSET $${idx++}`,
      qParams
    );
    res.json({ courses: result.rows, total: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post(
  '/courses',
  auditLog('create', 'course'),
  [
    body('course_code').isString().trim().isLength({ min: 1, max: 20 }).notEmpty(),
    body('course_name').isString().trim().isLength({ min: 1, max: 255 }).notEmpty(),
    body('total_weeks').isInt({ min: 1, max: 52 }),
    body('lecturer_ids').isArray({ min: 1 }),
    body('lecturer_ids.*').isInt({ min: 1 }),
    body('min_attendance_pct').optional().isInt({ min: 0, max: 100 }),
  ],
  handleValidation,
  async (req, res) => {
    if (denyUniversityAdmin(req, res)) return;
    const { course_code, course_name, total_weeks, lecturer_ids, min_attendance_pct } = req.body;
    const { level, department_id: scopeDeptId } = req.scope;
    const departmentId = level === 'department' ? scopeDeptId : (req.body.department_id || null);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'INSERT INTO courses (course_code, course_name, total_weeks, min_attendance_pct, department_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [course_code.toUpperCase(), course_name, total_weeks, min_attendance_pct ?? 70, departmentId]
      );
      const courseId = result.rows[0].id;
      for (const lid of lecturer_ids) {
        await client.query(
          'INSERT INTO course_lecturers (course_id, lecturer_id) VALUES ($1, $2)',
          [courseId, lid]
        );
      }
      await client.query('COMMIT');
      res.status(201).json({ course: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') return res.status(409).json({ error: 'A course with this code already exists.' });
      console.error(err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    } finally {
      client.release();
    }
  }
);

router.put(
  '/courses/:code',
  auditLog('update', 'course'),
  [
    body('course_name').isString().trim().isLength({ min: 1, max: 255 }).notEmpty(),
    body('total_weeks').isInt({ min: 1, max: 52 }),
    body('lecturer_ids').isArray({ min: 1 }),
    body('lecturer_ids.*').isInt({ min: 1 }),
    body('min_attendance_pct').optional().isInt({ min: 0, max: 100 }),
  ],
  handleValidation,
  async (req, res) => {
    if (denyUniversityAdmin(req, res)) return;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'UPDATE courses SET course_name = $1, total_weeks = $2, min_attendance_pct = $3 WHERE course_code = $4 RETURNING *',
        [req.body.course_name, req.body.total_weeks, req.body.min_attendance_pct ?? 70, req.params.code]
      );
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Course not found.' });
      }
      const courseId = result.rows[0].id;
      await client.query('DELETE FROM course_lecturers WHERE course_id = $1', [courseId]);
      for (const lid of req.body.lecturer_ids) {
        await client.query(
          'INSERT INTO course_lecturers (course_id, lecturer_id) VALUES ($1, $2)',
          [courseId, lid]
        );
      }
      await client.query('COMMIT');
      res.json({ course: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    } finally {
      client.release();
    }
  }
);

router.delete('/courses/:code', auditLog('delete', 'course'), async (req, res) => {
  if (denyUniversityAdmin(req, res)) return;
  try {
    await pool.query('UPDATE courses SET deleted_at = NOW() WHERE course_code = $1 AND deleted_at IS NULL', [req.params.code]);
    res.json({ message: 'Course deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.delete('/courses', auditLog('delete', 'course'), async (req, res) => {
  if (denyUniversityAdmin(req, res)) return;
  try {
    const { level, school_id, department_id } = req.scope;
    let whereClause = 'deleted_at IS NULL';
    const params = [];
    let idx = 1;
    if (level === 'department') {
      whereClause += ` AND department_id = $${idx++}`;
      params.push(department_id);
    } else if (level === 'school') {
      whereClause += ` AND department_id IN (SELECT id FROM departments WHERE school_id = $${idx++})`;
      params.push(school_id);
      if (req.query.department_id) {
        whereClause += ` AND department_id = $${idx++}`;
        params.push(req.query.department_id);
      }
    }
    const result = await pool.query(
      `UPDATE courses SET deleted_at = NOW() WHERE ${whereClause} RETURNING id`,
      params
    );
    res.json({ message: `${result.rowCount} course(s) deleted.`, count: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── Classes ──

router.get('/classes', async (req, res) => {
  try {
    const { level, university_id, school_id, department_id } = req.scope;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    let whereClause = 'WHERE c.deleted_at IS NULL';
    let params = [];
    let idx = 1;

    if (level === 'department') {
      whereClause += ` AND c.department_id = $${idx++}`;
      params.push(department_id);
    } else if (level === 'school') {
      whereClause += ` AND c.department_id IN (SELECT id FROM departments WHERE school_id = $${idx++})`;
      params.push(school_id);
      if (req.query.department_id) {
        whereClause += ` AND c.department_id = $${idx++}`;
        params.push(req.query.department_id);
      }
    } else if (level === 'university') {
      if (req.query.school_id) {
        whereClause += ` AND c.department_id IN (SELECT id FROM departments WHERE school_id = $${idx++})`;
        params.push(req.query.school_id);
      }
      if (req.query.department_id) {
        whereClause += ` AND c.department_id = $${idx++}`;
        params.push(req.query.department_id);
      }
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM classes c ${whereClause}`, params);
    const count = parseInt(countResult.rows[0].count);

    const qParams = [...params, limit, offset];
    const result = await pool.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM student_roster sr WHERE sr.class_id = c.class_id AND sr.deleted_at IS NULL) AS student_count,
              COALESCE(json_agg(json_build_object('id', l.id, 'name', l.name))
                FILTER (WHERE l.id IS NOT NULL), '[]') AS lecturers
       FROM classes c
       LEFT JOIN class_lecturers cl ON cl.class_id = c.class_id
       LEFT JOIN lecturers l ON l.id = cl.lecturer_id
       ${whereClause}
       GROUP BY c.class_id
       ORDER BY c.class_name
       LIMIT $${idx++} OFFSET $${idx++}`,
      qParams
    );
    res.json({ classes: result.rows, total: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post(
  '/classes',
  auditLog('create', 'class'),
  [
    body('class_name').isString().trim().isLength({ min: 1, max: 255 }).notEmpty(),
    body('lecturer_ids').isArray({ min: 1 }),
    body('lecturer_ids.*').isInt({ min: 1 }),
  ],
  handleValidation,
  async (req, res) => {
    const { level, department_id: scopeDeptId } = req.scope;
    const departmentId = level === 'department' ? scopeDeptId : (req.body.department_id || null);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'INSERT INTO classes (class_name, department_id) VALUES ($1, $2) RETURNING *',
        [req.body.class_name, departmentId]
      );
      const classId = result.rows[0].class_id;
      for (const lid of req.body.lecturer_ids) {
        await client.query(
          'INSERT INTO class_lecturers (class_id, lecturer_id) VALUES ($1, $2)',
          [classId, lid]
        );
      }
      await client.query('COMMIT');
      res.status(201).json({ class: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    } finally {
      client.release();
    }
  }
);

router.put(
  '/classes/:id',
  [
    body('class_name').isString().trim().isLength({ min: 1, max: 255 }).notEmpty(),
    body('lecturer_ids').isArray({ min: 1 }),
    body('lecturer_ids.*').isInt({ min: 1 }),
  ],
  handleValidation,
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'UPDATE classes SET class_name = $1 WHERE class_id = $2 RETURNING *',
        [req.body.class_name, req.params.id]
      );
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Class not found.' });
      }
      await client.query('DELETE FROM class_lecturers WHERE class_id = $1', [req.params.id]);
      for (const lid of req.body.lecturer_ids) {
        await client.query(
          'INSERT INTO class_lecturers (class_id, lecturer_id) VALUES ($1, $2)',
          [req.params.id, lid]
        );
      }
      await client.query('COMMIT');
      res.json({ class: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    } finally {
      client.release();
    }
  }
);

router.delete('/classes/:id', auditLog('delete', 'class'), async (req, res) => {
  try {
    await pool.query('UPDATE classes SET deleted_at = NOW() WHERE class_id = $1 AND deleted_at IS NULL', [req.params.id]);
    res.json({ message: 'Class deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.delete('/classes', auditLog('delete', 'class'), async (req, res) => {
  try {
    const { level, school_id, department_id } = req.scope;
    let whereClause = 'deleted_at IS NULL';
    const params = [];
    let idx = 1;
    if (level === 'department') {
      whereClause += ` AND department_id = $${idx++}`;
      params.push(department_id);
    } else if (level === 'school') {
      whereClause += ` AND department_id IN (SELECT id FROM departments WHERE school_id = $${idx++})`;
      params.push(school_id);
      if (req.query.department_id) {
        whereClause += ` AND department_id = $${idx++}`;
        params.push(req.query.department_id);
      }
    } else if (level === 'university') {
      if (req.query.school_id) {
        whereClause += ` AND department_id IN (SELECT id FROM departments WHERE school_id = $${idx++})`;
        params.push(req.query.school_id);
      }
      if (req.query.department_id) {
        whereClause += ` AND department_id = $${idx++}`;
        params.push(req.query.department_id);
      }
    }
    const result = await pool.query(`UPDATE classes SET deleted_at = NOW() WHERE ${whereClause} RETURNING class_id`, params);
    res.json({ message: `${result.rowCount} class(es) deleted.`, count: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── Students ──

router.get('/students', async (req, res) => {
  const { class_id } = req.query;
  const { level, university_id, school_id, department_id } = req.scope;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  try {
    let whereClause = 'WHERE sr.deleted_at IS NULL';
    let params = [];
    let idx = 1;

    if (class_id) {
      whereClause += ` AND sr.class_id = $${idx++}`;
      params.push(class_id);
    } else if (level === 'department') {
      whereClause += ` AND c.department_id = $${idx++}`;
      params.push(department_id);
    } else if (level === 'school') {
      whereClause += ` AND c.department_id IN (SELECT id FROM departments WHERE school_id = $${idx++})`;
      params.push(school_id);
      if (req.query.department_id) {
        whereClause += ` AND c.department_id = $${idx++}`;
        params.push(req.query.department_id);
      }
    } else if (level === 'university') {
      if (req.query.school_id) {
        whereClause += ` AND c.department_id IN (SELECT id FROM departments WHERE school_id = $${idx++})`;
        params.push(req.query.school_id);
      }
      if (req.query.department_id) {
        whereClause += ` AND c.department_id = $${idx++}`;
        params.push(req.query.department_id);
      }
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM student_roster sr JOIN classes c ON c.class_id = sr.class_id ${whereClause}`,
      params
    );
    const count = parseInt(countResult.rows[0].count);

    const qParams = [...params, limit, offset];
    const result = await pool.query(
      `SELECT sr.*, c.class_name FROM student_roster sr
       JOIN classes c ON c.class_id = sr.class_id
       ${whereClause}
       ORDER BY sr.student_name
       LIMIT $${idx++} OFFSET $${idx++}`,
      qParams
    );
    res.json({ students: result.rows, total: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post(
  '/students',
  [
    body('index_number').isString().trim().isLength({ min: 1, max: 50 }).notEmpty(),
    body('student_name').isString().trim().isLength({ min: 1, max: 255 }).notEmpty(),
    body('class_id').isInt({ min: 1 }),
  ],
  handleValidation,
  async (req, res) => {
    if (denyUniversityAdmin(req, res)) return;
    const { index_number, student_name, class_id } = req.body;
    try {
      // Check if a soft-deleted record with this index exists — restore it
      const existing = await pool.query(
        'SELECT id, student_name FROM student_roster WHERE index_number = $1 AND deleted_at IS NOT NULL',
        [index_number]
      );
      if (existing.rows.length > 0) {
        const restored = await pool.query(
          'UPDATE student_roster SET student_name = $1, class_id = $2, deleted_at = NULL WHERE id = $3 RETURNING *',
          [student_name, class_id, existing.rows[0].id]
        );
        return res.status(201).json({ student: restored.rows[0], restored: true });
      }
      const result = await pool.query(
        'INSERT INTO student_roster (index_number, student_name, class_id) VALUES ($1, $2, $3) RETURNING *',
        [index_number, student_name, class_id]
      );
      res.status(201).json({ student: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'A student with this index number is already registered.' });
      console.error(err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

router.put(
  '/students/:id',
  [
    body('index_number').isString().trim().isLength({ min: 1, max: 50 }).notEmpty(),
    body('student_name').isString().trim().isLength({ min: 1, max: 255 }).notEmpty(),
  ],
  handleValidation,
  async (req, res) => {
    if (denyUniversityAdmin(req, res)) return;
    const { index_number, student_name } = req.body;
    try {
      const result = await pool.query(
        'UPDATE student_roster SET index_number = $1, student_name = $2 WHERE id = $3 RETURNING *',
        [index_number, student_name, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Student not found.' });
      res.json({ student: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'A student with this index number is already registered.' });
      console.error(err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

router.delete('/students/:id', auditLog('delete', 'student'), async (req, res) => {
  if (denyUniversityAdmin(req, res)) return;
  try {
    await pool.query('UPDATE student_roster SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    res.json({ message: 'Student deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.delete('/students', auditLog('delete', 'student'), async (req, res) => {
  if (denyUniversityAdmin(req, res)) return;
  try {
    const { level, school_id, department_id } = req.scope;
    const { class_id } = req.query;
    let whereClause = 'sr.deleted_at IS NULL';
    const params = [];
    let idx = 1;

    if (class_id) {
      whereClause += ` AND sr.class_id = $${idx++}`;
      params.push(class_id);
    } else if (level === 'department') {
      whereClause += ` AND c.department_id = $${idx++}`;
      params.push(department_id);
    } else if (level === 'school') {
      whereClause += ` AND c.department_id IN (SELECT id FROM departments WHERE school_id = $${idx++})`;
      params.push(school_id);
      if (req.query.department_id) {
        whereClause += ` AND c.department_id = $${idx++}`;
        params.push(req.query.department_id);
      }
    }

    const result = await pool.query(
      `UPDATE student_roster sr SET deleted_at = NOW()
       FROM classes c
       WHERE c.class_id = sr.class_id AND ${whereClause}
       RETURNING sr.id`,
      params
    );
    res.json({ message: `${result.rowCount} student(s) deleted.`, count: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── CSV Bulk Import Students ──
router.post('/students/bulk', upload.single('file'), async (req, res) => {
  if (denyUniversityAdmin(req, res)) return;
  try {
    if (!req.file) return res.status(400).json({ error: 'CSV file needed.' });
    if (!req.body.class_id) return res.status(400).json({ error: 'Class required.' });

    const result = await importStudentRoster(pool, parseInt(req.body.class_id), req.file.buffer.toString('utf-8'));
    if (result.error) return res.status(400).json({ error: result.error });
    res.status(201).json({ added: result.added.length, skipped: result.skipped, errors: result.errors, students: result.added });
  } catch (err) {
    console.error('Bulk import error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── Semester / Year Export ──

router.get('/export/semester', async (req, res) => {
  const { start_date, end_date } = req.query;

  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date are required (YYYY-MM-DD).' });
  }

  try {
    const { level, school_id, department_id } = req.scope;

    // Fetch university name for header
    let uniName = 'ClassPulse University';
    let schoolName = '';
    let deptName = '';
    if (req.scope.university_id) {
      const uniRes = await pool.query('SELECT name FROM universities WHERE id = $1', [req.scope.university_id]);
      if (uniRes.rows.length > 0) uniName = uniRes.rows[0].name;
    }
    if (school_id) {
      const schoolRes = await pool.query('SELECT name FROM schools WHERE id = $1', [school_id]);
      if (schoolRes.rows.length > 0) schoolName = schoolRes.rows[0].name;
    }
    if (department_id) {
      const deptRes = await pool.query('SELECT name FROM departments WHERE id = $1', [department_id]);
      if (deptRes.rows.length > 0) deptName = deptRes.rows[0].name;
    }

    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ClassPulse';
    wb.created = new Date();

    const green = 'FF2563EB';
    const lightGreen = 'FFD1FAE5';
    const lightRed = 'FFFEE2E2';
    const lightGray = 'FFF4F7F6';
    const white = 'FFFFFFFF';
    const border = 'FFE2E8F0';
    const darkText = 'FF1E293B';
    const mutedText = 'FF64748B';

    let scopeWhere = '';
    const scopeParams = [];
    if (level === 'department') {
      scopeWhere = ' AND c.department_id = $3';
      scopeParams.push(department_id);
    } else if (level === 'school') {
      scopeWhere = ' AND c.department_id IN (SELECT id FROM departments WHERE school_id = $3)';
      scopeParams.push(school_id);
    }

    const sessionsResult = await pool.query(
      `SELECT s.session_id, s.course_code, c.course_name, s.class_id, cl.class_name,
              l.name AS lecturer_name, s.week_number, s.created_at, s.expires_at, s.is_active
       FROM active_sessions s
       JOIN courses c ON c.id = s.course_id
       JOIN classes cl ON cl.class_id = s.class_id
       LEFT JOIN lecturers l ON l.id = s.lecturer_id
       WHERE s.created_at >= $1 AND s.created_at < ($2::date + INTERVAL '1 day')${scopeWhere}
       ORDER BY c.course_name, cl.class_name, s.week_number`,
      [start_date, end_date, ...scopeParams]
    );
    const sessions = sessionsResult.rows;

    const sessionIds = sessions.map(s => s.session_id);
    let attendanceRows = [];
    if (sessionIds.length > 0) {
      const attRes = await pool.query(
        `SELECT ar.session_id, ar.index_number, COALESCE(sr.student_name, 'Deleted Student') AS student_name, ar.verification_method, ar.timestamp
         FROM attendance_records ar
         LEFT JOIN student_roster sr ON sr.index_number = ar.index_number AND sr.deleted_at IS NULL
         WHERE ar.session_id = ANY($1::uuid[])`,
        [sessionIds]
      );
      attendanceRows = attRes.rows;
    }

    let studentScopeWhere = '';
    const studentScopeParams = [];
    if (level === 'department') {
      studentScopeWhere = ' WHERE sr.deleted_at IS NULL AND c.department_id = $1';
      studentScopeParams.push(department_id);
    } else if (level === 'school') {
      studentScopeWhere = ' WHERE sr.deleted_at IS NULL AND c.department_id IN (SELECT id FROM departments WHERE school_id = $1)';
      studentScopeParams.push(school_id);
    } else {
      studentScopeWhere = ' WHERE sr.deleted_at IS NULL';
    }

    const studentsResult = await pool.query(
      `SELECT sr.index_number, sr.student_name, sr.class_id, c.class_name
       FROM student_roster sr
       JOIN classes c ON c.class_id = sr.class_id${studentScopeWhere}
       ORDER BY c.class_name, sr.student_name`,
      studentScopeParams
    );
    const students = studentsResult.rows;

    let courseScopeWhere = '';
    const courseScopeParams = [];
    if (level === 'department') {
      courseScopeWhere = ' WHERE c.department_id = $1';
      courseScopeParams.push(department_id);
    } else if (level === 'school') {
      courseScopeWhere = ' WHERE c.department_id IN (SELECT id FROM departments WHERE school_id = $1)';
      courseScopeParams.push(school_id);
    }

    const coursesResult = await pool.query(
      `SELECT c.course_code, c.course_name, c.total_weeks, c.min_attendance_pct,
              COALESCE(json_agg(DISTINCT jsonb_build_object('name', l.name)) FILTER (WHERE l.name IS NOT NULL), '[]') AS lecturers
       FROM courses c
       LEFT JOIN course_lecturers cl ON cl.course_id = c.id
       LEFT JOIN lecturers l ON l.id = cl.lecturer_id${courseScopeWhere}
       GROUP BY c.id
       ORDER BY c.course_name`,
      courseScopeParams
    );
    const courses = coursesResult.rows;

    // Sheet 1: Overview
    const wsOverview = wb.addWorksheet('Overview');

    // --- Boilerplate header rows (rows 1-4) ---
    const totalCols = 2;
    wsOverview.getColumn(1).width = 30;
    wsOverview.getColumn(2).width = 25;

    // Row 1: University name
    const uniRow = wsOverview.getRow(1);
    uniRow.height = 28;
    const uniCell = uniRow.getCell(1);
    uniCell.value = uniName;
    uniCell.font = { bold: true, size: 14, color: { argb: 'FF2563EB' }, name: 'Calibri' };
    uniCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsOverview.mergeCells(1, 1, 1, totalCols);

    // Row 2: Department placeholder
    const deptRow = wsOverview.getRow(2);
    deptRow.height = 22;
    const deptCell = deptRow.getCell(1);
    deptCell.value = [schoolName, deptName].filter(Boolean).join(' - ') || uniName;
    deptCell.font = { bold: true, size: 11, color: { argb: darkText }, name: 'Calibri' };
    deptCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsOverview.mergeCells(2, 1, 2, totalCols);

    // Row 3: Export period
    const infoRow = wsOverview.getRow(3);
    infoRow.height = 20;
    const infoCell = infoRow.getCell(1);
    infoCell.value = `Semester Export  |  ${start_date} to ${end_date}`;
    infoCell.font = { size: 10, color: { argb: darkText }, name: 'Calibri' };
    infoCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsOverview.mergeCells(3, 1, 3, totalCols);

    // Row 4: Blank separator
    wsOverview.getRow(4).height = 8;

    // Table header (row 5)
    const overviewHeaderRow = wsOverview.getRow(5);
    overviewHeaderRow.getCell(1).value = 'Metric';
    overviewHeaderRow.getCell(2).value = 'Value';
    overviewHeaderRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: white }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: green } };
      cell.border = {
        top: { style: 'thin', color: { argb: border } },
        left: { style: 'thin', color: { argb: border } },
        bottom: { style: 'thin', color: { argb: border } },
        right: { style: 'thin', color: { argb: border } },
      };
    });

    const uniqueStudents = new Set(attendanceRows.map(a => a.index_number));
    const overallRate = sessions.length > 0
      ? Math.round((attendanceRows.length / (sessions.length * students.length)) * 100) || 0
      : 0;

    const overviewData = [
      { metric: 'Export Period', value: `${start_date} to ${end_date}` },
      { metric: 'Generated At', value: new Date().toISOString() },
      { metric: 'Total Courses', value: courses.length },
      { metric: 'Total Sessions', value: sessions.length },
      { metric: 'Total Students', value: students.length },
      { metric: 'Unique Students Attended', value: uniqueStudents.size },
      { metric: 'Total Attendance Records', value: attendanceRows.length },
      { metric: 'Overall Attendance Rate', value: `${overallRate}%` },
    ];
    overviewData.forEach((row, i) => {
      const r = wsOverview.getRow(6 + i);
      r.getCell(1).value = row.metric;
      r.getCell(2).value = row.value;
      r.getCell(1).font = { size: 10, color: { argb: darkText } };
      r.getCell(2).font = { size: 10, color: { argb: darkText }, bold: true };
    });

    // Freeze pane below header
    wsOverview.views = [{ state: 'frozen', ySplit: 5 }];

    // Sheet 2: Courses
    const wsCourses = wb.addWorksheet('Courses');
    wsCourses.columns = [
      { header: 'Code', key: 'code', width: 14 },
      { header: 'Course Name', key: 'name', width: 30 },
      { header: 'Total Weeks', key: 'weeks', width: 14 },
      { header: 'Min Attendance %', key: 'min_pct', width: 18 },
      { header: 'Lecturers', key: 'lecturers', width: 30 },
      { header: 'Sessions', key: 'sessions', width: 12 },
      { header: 'Attendance Records', key: 'records', width: 20 },
    ];
    for (const course of courses) {
      const courseSessions = sessions.filter(s => s.course_code === course.course_code);
      const courseSessionIds = new Set(courseSessions.map(s => s.session_id));
      const courseRecords = attendanceRows.filter(a => courseSessionIds.has(a.session_id));
      wsCourses.addRow({
        code: course.course_code,
        name: course.course_name,
        weeks: course.total_weeks,
        min_pct: course.min_attendance_pct,
        lecturers: course.lecturers.map(l => l.name).join(', ') || '—',
        sessions: courseSessions.length,
        records: courseRecords.length,
      });
    }
    wsCourses.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: white }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: green } };
      cell.border = {
        top: { style: 'thin', color: { argb: border } },
        left: { style: 'thin', color: { argb: border } },
        bottom: { style: 'thin', color: { argb: border } },
        right: { style: 'thin', color: { argb: border } },
      };
    });

    // Sheet 3: Sessions
    const wsSessions = wb.addWorksheet('Sessions');
    wsSessions.columns = [
      { header: 'Course', key: 'course', width: 14 },
      { header: 'Class', key: 'class', width: 22 },
      { header: 'Week', key: 'week', width: 10 },
      { header: 'Lecturer', key: 'lecturer', width: 22 },
      { header: 'Created At', key: 'created', width: 22 },
      { header: 'Expires At', key: 'expires', width: 22 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Attendees', key: 'attendees', width: 12 },
    ];
    for (const s of sessions) {
      const attendees = attendanceRows.filter(a => a.session_id === s.session_id).length;
      wsSessions.addRow({
        course: s.course_code,
        class: s.class_name,
        week: s.week_number,
        lecturer: s.lecturer_name || '—',
        created: s.created_at ? new Date(s.created_at).toLocaleString() : '—',
        expires: s.expires_at ? new Date(s.expires_at).toLocaleString() : '—',
        status: s.is_active ? 'Active' : 'Ended',
        attendees,
      });
    }
    wsSessions.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: white }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: green } };
      cell.border = {
        top: { style: 'thin', color: { argb: border } },
        left: { style: 'thin', color: { argb: border } },
        bottom: { style: 'thin', color: { argb: border } },
        right: { style: 'thin', color: { argb: border } },
      };
    });

    // Sheet 4: Attendance Ledger
    const wsAtt = wb.addWorksheet('Attendance');
    wsAtt.columns = [
      { header: 'Session ID', key: 'session', width: 38 },
      { header: 'Course', key: 'course', width: 14 },
      { header: 'Class', key: 'class', width: 22 },
      { header: 'Week', key: 'week', width: 10 },
      { header: 'Index Number', key: 'index', width: 18 },
      { header: 'Student Name', key: 'name', width: 24 },
      { header: 'Method', key: 'method', width: 14 },
      { header: 'Timestamp', key: 'timestamp', width: 22 },
    ];
    const sessionMap = new Map(sessions.map(s => [s.session_id, s]));
    for (const a of attendanceRows) {
      const sess = sessionMap.get(a.session_id);
      wsAtt.addRow({
        session: a.session_id,
        course: sess?.course_code || '—',
        class: sess?.class_name || '—',
        week: sess?.week_number || '—',
        index: a.index_number,
        name: a.student_name,
        method: a.verification_method,
        timestamp: a.timestamp ? new Date(a.timestamp).toLocaleString() : '—',
      });
    }
    wsAtt.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: white }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: green } };
      cell.border = {
        top: { style: 'thin', color: { argb: border } },
        left: { style: 'thin', color: { argb: border } },
        bottom: { style: 'thin', color: { argb: border } },
        right: { style: 'thin', color: { argb: border } },
      };
    });

    // Sheet 5: Students
    const wsStudents = wb.addWorksheet('Students');
    wsStudents.columns = [
      { header: 'Index Number', key: 'index', width: 18 },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Class', key: 'class', width: 22 },
      { header: 'Sessions Attended', key: 'attended', width: 20 },
      { header: 'Total Sessions in Class', key: 'total', width: 24 },
      { header: 'Attendance %', key: 'pct', width: 16 },
    ];
    const classSessionCount = {};
    for (const s of sessions) {
      const key = s.class_name;
      classSessionCount[key] = (classSessionCount[key] || 0) + 1;
    }
    const studentAttendanceCount = {};
    for (const a of attendanceRows) {
      studentAttendanceCount[a.index_number] = (studentAttendanceCount[a.index_number] || 0) + 1;
    }
    for (const st of students) {
      const attended = studentAttendanceCount[st.index_number] || 0;
      const total = classSessionCount[st.class_name] || 0;
      const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
      const row = wsStudents.addRow({
        index: st.index_number,
        name: st.student_name,
        class: st.class_name,
        attended,
        total,
        pct: `${pct}%`,
      });
      const pctCell = row.getCell(6);
      pctCell.font = { bold: true, color: { argb: pct >= 50 ? 'FF16A34A' : 'FFDC2626' } };
    }
    wsStudents.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: white }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: green } };
      cell.border = {
        top: { style: 'thin', color: { argb: border } },
        left: { style: 'thin', color: { argb: border } },
        bottom: { style: 'thin', color: { argb: border } },
        right: { style: 'thin', color: { argb: border } },
      };
    });

    const buf = await wb.xlsx.writeBuffer();
    const fileName = `classpulse_export_${start_date}_to_${end_date}.xlsx`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buf);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── Reset / Clear Records ──

router.post('/reset',
  auditLog('reset', 'system'),
  async (req, res) => {
  if (req.scope.level !== 'university') {
    return res.status(403).json({ error: 'University admin access required.' });
  }

  const { scope, confirm_text } = req.body;

  if (confirm_text !== 'DELETE ALL') {
    return res.status(400).json({ error: 'Confirmation text did not match "DELETE ALL".' });
  }

  const allowedScopes = ['students', 'all'];
  if (!scope || !allowedScopes.includes(scope)) {
    return res.status(400).json({ error: `scope must be one of: ${allowedScopes.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (scope === 'students') {
      const r = await client.query('UPDATE student_roster SET deleted_at = NOW() WHERE deleted_at IS NULL');
      await client.query('COMMIT');
      return res.json({ message: 'All student records soft-deleted.', count: r.rowCount });
    }

    // scope === 'all'
    const r1 = await client.query('UPDATE attendance_records SET deleted_at = NOW() WHERE deleted_at IS NULL');
    const r2 = await client.query('UPDATE active_sessions SET deleted_at = NOW() WHERE deleted_at IS NULL');
    const r3 = await client.query('UPDATE student_roster SET deleted_at = NOW() WHERE deleted_at IS NULL');
    const r4 = await client.query('DELETE FROM course_lecturers');
    const r5 = await client.query('DELETE FROM class_lecturers');
    const r6 = await client.query('UPDATE courses SET deleted_at = NOW() WHERE deleted_at IS NULL');
    const r7 = await client.query('UPDATE classes SET deleted_at = NOW() WHERE deleted_at IS NULL');
    await client.query('COMMIT');

    return res.json({
      message: 'All data soft-deleted.',
      attendance_deleted: r1.rowCount,
      sessions_deleted: r2.rowCount,
      students_deleted: r3.rowCount,
      courses_deleted: r6.rowCount,
      classes_deleted: r7.rowCount,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reset error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  } finally {
    client.release();
  }
});

// ── Academic Years ──

router.get('/academic-years', async (req, res) => {
  try {
    const { university_id } = req.scope;
    let result;
    if (university_id) {
      result = await pool.query('SELECT * FROM academic_years WHERE university_id = $1 ORDER BY start_year DESC, label', [university_id]);
    } else {
      result = await pool.query('SELECT * FROM academic_years ORDER BY start_year DESC, label');
    }
    res.json({ academic_years: result.rows });
  } catch (err) {
    console.error('List academic years error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post(
  '/academic-years',
  [
    body('label').isString().trim().notEmpty(),
    body('start_year').isInt({ min: 2020, max: 2100 }),
    body('end_year').isInt({ min: 2020, max: 2100 }),
  ],
  handleValidation,
  async (req, res) => {
    const { label, start_year, end_year } = req.body;
    const universityId = req.scope.university_id;
    try {
      const result = await pool.query(
        'INSERT INTO academic_years (label, start_year, end_year, university_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [label, start_year, end_year, universityId]
      );
      res.status(201).json({ academic_year: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Academic year label already exists.' });
      console.error('Create academic year error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

router.delete('/academic-years/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM academic_years WHERE id = $1', [req.params.id]);
    res.json({ message: 'Academic year deleted.' });
  } catch (err) {
    console.error('Delete academic year error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.delete('/academic-years', async (req, res) => {
  try {
    const { university_id } = req.scope;
    let query = 'DELETE FROM academic_years';
    const params = [];
    if (university_id) {
      query = 'DELETE FROM academic_years WHERE university_id = $1';
      params.push(university_id);
    }
    const result = await pool.query(query, params);
    res.json({ message: `${result.rowCount} academic year(s) deleted.`, count: result.rowCount });
  } catch (err) {
    console.error('Delete all academic years error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── Semesters ──

router.get('/semesters', async (req, res) => {
  try {
    const { university_id } = req.scope;
    let query, params;
    if (university_id) {
      query = `SELECT s.*, ay.label AS year_label, ay.start_year, ay.end_year
               FROM semesters s
               JOIN academic_years ay ON ay.id = s.academic_year_id
               WHERE ay.university_id = $1
               ORDER BY ay.start_year DESC, s.number`;
      params = [university_id];
    } else {
      query = `SELECT s.*, ay.label AS year_label, ay.start_year, ay.end_year
               FROM semesters s
               JOIN academic_years ay ON ay.id = s.academic_year_id
               ORDER BY ay.start_year DESC, s.number`;
      params = [];
    }
    const result = await pool.query(query, params);
    res.json({ semesters: result.rows });
  } catch (err) {
    console.error('List semesters error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post(
  '/semesters',
  [
    body('academic_year_id').isInt({ min: 1 }),
    body('number').isIn([1, 2]),
    body('start_date').isISO8601(),
    body('end_date').isISO8601(),
  ],
  handleValidation,
  async (req, res) => {
    const { academic_year_id, number, start_date, end_date } = req.body;
    try {
      // Fetch the year label to build semester label
      const yearRes = await pool.query('SELECT label FROM academic_years WHERE id = $1', [academic_year_id]);
      if (yearRes.rows.length === 0) {
        return res.status(404).json({ error: 'Academic year not found.' });
      }
      const label = `${yearRes.rows[0].label} - Semester ${number}`;

      const result = await pool.query(
        'INSERT INTO semesters (academic_year_id, number, label, start_date, end_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [academic_year_id, number, label, start_date, end_date]
      );
      res.status(201).json({ semester: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Semester already exists for this year.' });
      console.error('Create semester error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

router.put(
  '/semesters/:id',
  [
    body('start_date').optional().isISO8601(),
    body('end_date').optional().isISO8601(),
  ],
  handleValidation,
  async (req, res) => {
    const { start_date, end_date } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;

    if (start_date) { fields.push(`start_date = $${idx}`); values.push(start_date); idx++; }
    if (end_date) { fields.push(`end_date = $${idx}`); values.push(end_date); idx++; }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(req.params.id);

    try {
      const result = await pool.query(
        `UPDATE semesters SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Semester not found.' });
      res.json({ semester: result.rows[0] });
    } catch (err) {
      console.error('Update semester error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

router.delete('/semesters/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM semesters WHERE id = $1', [req.params.id]);
    res.json({ message: 'Semester deleted.' });
  } catch (err) {
    console.error('Delete semester error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.delete('/semesters', async (req, res) => {
  try {
    const { university_id } = req.scope;
    let query = 'DELETE FROM semesters';
    const params = [];
    if (university_id) {
      query = `DELETE FROM semesters
               WHERE academic_year_id IN (SELECT id FROM academic_years WHERE university_id = $1)`;
      params.push(university_id);
    }
    const result = await pool.query(query, params);
    res.json({ message: `${result.rowCount} semester(s) deleted.`, count: result.rowCount });
  } catch (err) {
    console.error('Delete all semesters error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.post('/semesters/:id/activate', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Deactivate all semesters
    await client.query('UPDATE semesters SET is_active = false');
    // Activate the target
    const result = await client.query(
      'UPDATE semesters SET is_active = true WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Semester not found.' });
    }
    await client.query('COMMIT');
    res.json({ semester: result.rows[0], message: 'Semester activated.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Activate semester error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  } finally {
    client.release();
  }
});

// ── Active Semester (public) ──

router.get('/active-semester', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, ay.label AS year_label, ay.start_year, ay.end_year
       FROM semesters s
       JOIN academic_years ay ON ay.id = s.academic_year_id
       WHERE s.is_active = true
       LIMIT 1`
    );
    res.json({ semester: result.rows[0] || null });
  } catch (err) {
    console.error('Active semester error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// GET /audit-logs — List audit logs (university admin only)
router.get('/audit-logs', async (req, res) => {
  if (req.scope.level !== 'university') {
    return res.status(403).json({ error: 'University admin access required.' });
  }
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const { entity_type, action } = req.query;
  try {
    let whereClause = '';
    let params = [];
    let idx = 1;
    if (entity_type) { whereClause += ` AND al.entity_type = $${idx++}`; params.push(entity_type); }
    if (action) { whereClause += ` AND al.action = $${idx++}`; params.push(action); }

    const countResult = await pool.query(`SELECT COUNT(*) FROM audit_logs al WHERE 1=1 ${whereClause}`, params);
    const count = parseInt(countResult.rows[0].count);

    const qParams = [...params, limit, offset];
    const result = await pool.query(
      `SELECT al.*, a.name AS admin_name, a.email AS admin_email
       FROM audit_logs al
       LEFT JOIN admins a ON a.id = al.admin_id
       WHERE 1=1 ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      qParams
    );
    res.json({ logs: result.rows, total: count });
  } catch (err) {
    console.error('List audit logs error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── University Stats (university admin overview) ──

router.get('/university-stats', async (req, res) => {
  if (req.scope.level !== 'university') {
    return res.status(403).json({ error: 'University admin access required.' });
  }
  try {
    const { university_id } = req.scope;
    const [schoolsRes, departmentsRes, coursesRes, lecturersRes, classesRes, studentsRes, hallsRes, adminsRes, sessionsRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM schools WHERE university_id = $1 AND deleted_at IS NULL', [university_id]),
      pool.query('SELECT COUNT(*) FROM departments d JOIN schools s ON s.id = d.school_id WHERE s.university_id = $1 AND d.deleted_at IS NULL', [university_id]),
      pool.query('SELECT COUNT(*) FROM courses co JOIN departments d ON d.id = co.department_id JOIN schools s ON s.id = d.school_id WHERE s.university_id = $1 AND co.deleted_at IS NULL', [university_id]),
      pool.query('SELECT COUNT(*) FROM lecturers l JOIN departments d ON d.id = l.department_id JOIN schools s ON s.id = d.school_id WHERE s.university_id = $1 AND l.deleted_at IS NULL', [university_id]),
      pool.query('SELECT COUNT(*) FROM classes cl JOIN departments d ON d.id = cl.department_id JOIN schools s ON s.id = d.school_id WHERE s.university_id = $1 AND cl.deleted_at IS NULL', [university_id]),
      pool.query('SELECT COUNT(*) FROM student_roster sr JOIN classes cl ON cl.class_id = sr.class_id JOIN departments d ON d.id = cl.department_id JOIN schools s ON s.id = d.school_id WHERE s.university_id = $1 AND sr.deleted_at IS NULL', [university_id]),
      pool.query('SELECT COUNT(*) FROM lecture_halls WHERE university_id = $1', [university_id]),
      pool.query("SELECT COUNT(*) FROM admins WHERE university_id = $1 AND role != 'university' AND deleted_at IS NULL", [university_id]),
      pool.query(`SELECT COUNT(*) FROM active_sessions a
                  JOIN courses co ON co.id = a.course_id
                  JOIN departments d ON d.id = co.department_id
                  JOIN schools s ON s.id = d.school_id
                  WHERE s.university_id = $1 AND a.is_active = true`, [university_id]),
    ]);
    res.json({
      schools: parseInt(schoolsRes.rows[0].count),
      departments: parseInt(departmentsRes.rows[0].count),
      courses: parseInt(coursesRes.rows[0].count),
      lecturers: parseInt(lecturersRes.rows[0].count),
      classes: parseInt(classesRes.rows[0].count),
      students: parseInt(studentsRes.rows[0].count),
      lecture_halls: parseInt(hallsRes.rows[0].count),
      admins: parseInt(adminsRes.rows[0].count),
      active_sessions: parseInt(sessionsRes.rows[0].count),
    });
  } catch (err) {
    console.error('University stats error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── Recent Sessions ──
router.get('/recent-sessions', async (req, res) => {
  try {
    const { university_id, school_id, department_id } = req.scope;
    let query;
    let params;

    if (req.scope.level === 'university') {
      query = `SELECT ss.session_id AS id, co.course_name, co.course_code,
                     TO_CHAR(ss.created_at, 'Mon DD, YYYY') AS date,
                     COALESCE((SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = ss.session_id), 0) AS present_count,
                     COALESCE((SELECT COUNT(*) FROM student_roster sr WHERE sr.class_id = ss.class_id AND sr.deleted_at IS NULL), 0) AS total_students,
                     CASE WHEN (SELECT COUNT(*) FROM student_roster sr WHERE sr.class_id = ss.class_id AND sr.deleted_at IS NULL) > 0
                       THEN ROUND((SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = ss.session_id)::numeric /
                           (SELECT COUNT(*) FROM student_roster sr WHERE sr.class_id = ss.class_id AND sr.deleted_at IS NULL) * 100, 0)
                       ELSE 0 END AS attendance_rate,
                     CASE WHEN ss.is_active = true THEN 'in_progress' ELSE 'completed' END AS status
              FROM active_sessions ss
              JOIN courses co ON co.id = ss.course_id
              JOIN departments d ON d.id = co.department_id
              JOIN schools s ON s.id = d.school_id
              WHERE s.university_id = $1
              ORDER BY ss.created_at DESC LIMIT 7`;
      params = [university_id];
    } else if (req.scope.level === 'school') {
      query = `SELECT ss.session_id AS id, co.course_name, co.course_code,
                     TO_CHAR(ss.created_at, 'Mon DD, YYYY') AS date,
                     COALESCE((SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = ss.session_id), 0) AS present_count,
                     COALESCE((SELECT COUNT(*) FROM student_roster sr WHERE sr.class_id = ss.class_id AND sr.deleted_at IS NULL), 0) AS total_students,
                     CASE WHEN (SELECT COUNT(*) FROM student_roster sr WHERE sr.class_id = ss.class_id AND sr.deleted_at IS NULL) > 0
                       THEN ROUND((SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = ss.session_id)::numeric /
                           (SELECT COUNT(*) FROM student_roster sr WHERE sr.class_id = ss.class_id AND sr.deleted_at IS NULL) * 100, 0)
                       ELSE 0 END AS attendance_rate,
                     CASE WHEN ss.is_active = true THEN 'in_progress' ELSE 'completed' END AS status
              FROM active_sessions ss
              JOIN courses co ON co.id = ss.course_id
              JOIN departments d ON d.id = co.department_id
              WHERE d.school_id = $1
              ORDER BY ss.created_at DESC LIMIT 7`;
      params = [school_id];
    } else {
      query = `SELECT ss.session_id AS id, co.course_name, co.course_code,
                     TO_CHAR(ss.created_at, 'Mon DD, YYYY') AS date,
                     COALESCE((SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = ss.session_id), 0) AS present_count,
                     COALESCE((SELECT COUNT(*) FROM student_roster sr WHERE sr.class_id = ss.class_id AND sr.deleted_at IS NULL), 0) AS total_students,
                     CASE WHEN (SELECT COUNT(*) FROM student_roster sr WHERE sr.class_id = ss.class_id AND sr.deleted_at IS NULL) > 0
                       THEN ROUND((SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = ss.session_id)::numeric /
                           (SELECT COUNT(*) FROM student_roster sr WHERE sr.class_id = ss.class_id AND sr.deleted_at IS NULL) * 100, 0)
                       ELSE 0 END AS attendance_rate,
                     CASE WHEN ss.is_active = true THEN 'in_progress' ELSE 'completed' END AS status
              FROM active_sessions ss
              JOIN courses co ON co.id = ss.course_id
              WHERE co.department_id = $1
              ORDER BY ss.created_at DESC LIMIT 7`;
      params = [department_id];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Recent sessions error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── School Stats (school admin) ──
router.get('/school-stats', async (req, res) => {
  if (req.scope.level !== 'school') {
    return res.status(403).json({ error: 'School admin access required.' });
  }
  try {
    const { school_id } = req.scope;
    if (!school_id) return res.status(400).json({ error: 'School ID required.' });

    const [deptRes, lecturerRes, studentRes, sessionRes, avgAttRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM departments WHERE school_id = $1', [school_id]),
      pool.query('SELECT COUNT(*) FROM lecturers l JOIN departments d ON d.id = l.department_id WHERE d.school_id = $1 AND l.deleted_at IS NULL', [school_id]),
      pool.query(`SELECT COUNT(*) FROM student_roster sr
                   JOIN classes cl ON cl.class_id = sr.class_id
                   JOIN departments d ON d.id = cl.department_id
                   WHERE d.school_id = $1 AND sr.deleted_at IS NULL`, [school_id]),
      pool.query(`SELECT COUNT(*) FROM active_sessions ss
                   JOIN courses co ON co.id = ss.course_id
                   JOIN departments d ON d.id = co.department_id
                   WHERE d.school_id = $1 AND ss.is_active = true`, [school_id]),
      pool.query(`SELECT COALESCE(ROUND(AVG(subq.rate)), 0) AS avg_attendance
                   FROM (
                     SELECT ss.session_id,
                            CASE WHEN COUNT(sr.id) > 0
                              THEN (COUNT(ar.record_id)::numeric / COUNT(sr.id)) * 100
                              ELSE 0 END AS rate
                     FROM active_sessions ss
                     JOIN courses co ON co.id = ss.course_id
                     JOIN departments d ON d.id = co.department_id
                     LEFT JOIN attendance_records ar ON ar.session_id = ss.session_id
                     LEFT JOIN student_roster sr ON sr.class_id = ss.class_id AND sr.deleted_at IS NULL
                     WHERE d.school_id = $1
                     GROUP BY ss.session_id
                   ) subq`, [school_id]),
    ]);

    res.json({
      departments: parseInt(deptRes.rows[0].count),
      lecturers: parseInt(lecturerRes.rows[0].count),
      students: parseInt(studentRes.rows[0].count),
      active_sessions: parseInt(sessionRes.rows[0].count),
      avg_attendance: parseFloat(avgAttRes.rows[0].avg_attendance),
    });
  } catch (err) {
    console.error('School stats error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── Recent Activity (school + department admin) ──
router.get('/recent-activity', async (req, res) => {
  if (!['school', 'department'].includes(req.scope.level)) {
    return res.status(403).json({ error: "You don't have permission to do this." });
  }
  try {
    const { level, school_id, department_id } = req.scope;
    let query, params;

    if (level === 'school') {
      query = `SELECT 'session' AS type, co.course_name, ss.created_at,
                      CASE WHEN ss.is_active THEN 'in_progress' ELSE 'completed' END AS status,
                      COALESCE(ROUND(
                        (SELECT COUNT(*) FROM attendance_records WHERE session_id = ss.session_id)::numeric
                        / NULLIF((SELECT COUNT(*) FROM student_roster WHERE class_id = ss.class_id AND deleted_at IS NULL), 0) * 100
                      ), 0) AS rate
               FROM active_sessions ss
               JOIN courses co ON co.id = ss.course_id
               JOIN departments d ON d.id = co.department_id
               WHERE d.school_id = $1 AND ss.created_at >= NOW() - INTERVAL '7 days'
               ORDER BY ss.created_at DESC LIMIT 10`;
      params = [school_id];
    } else {
      query = `SELECT 'session' AS type, co.course_name, ss.created_at,
                      CASE WHEN ss.is_active THEN 'in_progress' ELSE 'completed' END AS status,
                      COALESCE(ROUND(
                        (SELECT COUNT(*) FROM attendance_records WHERE session_id = ss.session_id)::numeric
                        / NULLIF((SELECT COUNT(*) FROM student_roster WHERE class_id = ss.class_id AND deleted_at IS NULL), 0) * 100
                      ), 0) AS rate
               FROM active_sessions ss
               JOIN courses co ON co.id = ss.course_id
               WHERE co.department_id = $1 AND ss.created_at >= NOW() - INTERVAL '7 days'
               ORDER BY ss.created_at DESC LIMIT 10`;
      params = [department_id];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Recent activity error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── Admin Management (university admin only) ──

router.get('/admin-users', async (req, res) => {
  if (req.scope.level !== 'university') {
    return res.status(403).json({ error: 'University admin access required.' });
  }
  try {
    const result = await pool.query(
      `SELECT a.id, a.name, a.email, a.role, a.university_id, a.school_id, a.department_id,
              a.created_at,
              s.name AS school_name, d.name AS department_name
       FROM admins a
       LEFT JOIN schools s ON s.id = a.school_id
       LEFT JOIN departments d ON d.id = a.department_id
       WHERE a.university_id = $1 AND a.deleted_at IS NULL
       ORDER BY a.name`,
      [req.scope.university_id]
    );
    res.json({ admins: result.rows });
  } catch (err) {
    console.error('List admin users error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── User Recovery: Admin resets any user's password (university admin only) ──

router.post('/users/:id/reset-password',
  auditLog('reset_password', 'user'),
  [body('password').isString().isLength({ min: 8, max: 128 })],
  async (req, res) => {
    if (req.scope.level !== 'university') {
      return res.status(403).json({ error: 'University admin access required.' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    const { user_type } = req.body;
    try {
      const hash = await bcrypt.hash(req.body.password, 10);
      let result;
      if (user_type === 'lecturer') {
        result = await pool.query(
          'UPDATE lecturers SET password_hash = $1 WHERE id = $2 RETURNING id, name, email',
          [hash, id]
        );
      } else {
        result = await pool.query(
          'UPDATE admins SET password_hash = $1 WHERE id = $2 AND university_id = $3 RETURNING id, name, email',
          [hash, id, req.scope.university_id]
        );
      }
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }
      res.json({ message: 'Password reset successfully.', user: result.rows[0] });
    } catch (err) {
      console.error('Reset password error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

// ── Emergency: Force-close a session (university admin only) ──

router.post('/sessions/:sessionId/force-close',
  auditLog('force_close', 'session'),
  async (req, res) => {
    if (req.scope.level !== 'university') {
      return res.status(403).json({ error: 'University admin access required.' });
    }
    const { sessionId } = req.params;
    try {
      const result = await pool.query(
        `UPDATE active_sessions SET is_active = false WHERE session_id = $1 RETURNING session_id, course_code`,
        [sessionId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found or has ended.' });
      }
      const sessionCache = require('../services/sessionCache');
      sessionCache.deactivate(sessionId);
      res.json({ message: 'Session force-closed.', session: result.rows[0] });
    } catch (err) {
      console.error('Force close error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

// ── Emergency: Override attendance record (university admin only) ──

router.post('/attendance/override',
  auditLog('override', 'attendance'),
  [
    body('session_id').isString().trim().isLength({ min: 1 }),
    body('student_id').isString().trim().isLength({ min: 1 }),
    body('status').isIn(['present', 'absent']),
  ],
  async (req, res) => {
    if (req.scope.level !== 'university') {
      return res.status(403).json({ error: 'University admin access required.' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { session_id, student_id: index_number, status } = req.body;
    try {
      if (status === 'present') {
        await pool.query(
          `INSERT INTO attendance_records (session_id, index_number, verification_method, timestamp)
           VALUES ($1, $2, 'MANUAL', NOW())
           ON CONFLICT (session_id, index_number) DO UPDATE SET timestamp = NOW()`,
          [session_id, index_number]
        );
      } else {
        await pool.query(
          'DELETE FROM attendance_records WHERE session_id = $1 AND index_number = $2',
          [session_id, index_number]
        );
      }
      res.json({ message: `Attendance overridden to ${status}.` });
    } catch (err) {
      console.error('Override attendance error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

// ── Emergency: List active sessions (university admin only) ──

router.get('/active-sessions', async (req, res) => {
  if (req.scope.level !== 'university') {
    return res.status(403).json({ error: 'University admin access required.' });
  }
  try {
    const result = await pool.query(
      `SELECT a.*, c.course_name
       FROM active_sessions a
       JOIN courses c ON c.id = a.course_id
       JOIN departments d ON d.id = c.department_id
       JOIN schools s ON s.id = d.school_id
       WHERE s.university_id = $1
       ORDER BY a.created_at DESC`,
      [req.scope.university_id]
    );
    res.json({ sessions: result.rows });
  } catch (err) {
    console.error('List active sessions error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
