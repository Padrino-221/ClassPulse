const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken('admin'));

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// ── Lecturers ──

router.get('/lecturers', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const count = await pool.query('SELECT COUNT(*) FROM lecturers');
    const result = await pool.query('SELECT id, name, email, created_at FROM lecturers ORDER BY name LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ lecturers: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.post(
  '/lecturers',
  [
    body('name').isString().trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password').isString().isLength({ min: 6 }),
  ],
  handleValidation,
  async (req, res) => {
    const { name, email, password } = req.body;
    try {
      const hash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        'INSERT INTO lecturers (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
        [name, email, hash]
      );
      res.status(201).json({ lecturer: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Email taken.' });
      console.error(err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  }
);

router.put(
  '/lecturers/:id',
  [
    body('name').isString().trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
  ],
  handleValidation,
  async (req, res) => {
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
      if (err.code === '23505') return res.status(409).json({ error: 'Email taken.' });
      console.error(err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  }
);

router.delete('/lecturers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM lecturers WHERE id = $1', [req.params.id]);
    res.json({ message: 'Lecturer deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ── Courses ──

router.get('/courses', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const count = await pool.query('SELECT COUNT(*) FROM courses');
    const result = await pool.query(
      `SELECT c.*,
              COALESCE(json_agg(json_build_object('id', l.id, 'name', l.name))
                FILTER (WHERE l.id IS NOT NULL), '[]') AS lecturers
       FROM courses c
       LEFT JOIN course_lecturers cl ON cl.course_code = c.course_code
       LEFT JOIN lecturers l ON l.id = cl.lecturer_id
       GROUP BY c.course_code
       ORDER BY c.course_name
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ courses: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.post(
  '/courses',
  [
    body('course_code').isString().trim().notEmpty(),
    body('course_name').isString().trim().notEmpty(),
    body('total_weeks').isInt({ min: 1, max: 52 }),
    body('lecturer_ids').isArray({ min: 1 }),
    body('lecturer_ids.*').isInt({ min: 1 }),
    body('min_attendance_pct').optional().isInt({ min: 0, max: 100 }),
  ],
  handleValidation,
  async (req, res) => {
    const { course_code, course_name, total_weeks, lecturer_ids, min_attendance_pct } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'INSERT INTO courses (course_code, course_name, total_weeks, min_attendance_pct) VALUES ($1, $2, $3, $4) RETURNING *',
        [course_code.toUpperCase(), course_name, total_weeks, min_attendance_pct ?? 70]
      );
      for (const lid of lecturer_ids) {
        await client.query(
          'INSERT INTO course_lecturers (course_code, lecturer_id) VALUES ($1, $2)',
          [course_code.toUpperCase(), lid]
        );
      }
      await client.query('COMMIT');
      res.status(201).json({ course: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') return res.status(409).json({ error: 'Code taken.' });
      console.error(err);
      res.status(500).json({ error: 'Something went wrong.' });
    } finally {
      client.release();
    }
  }
);

router.put(
  '/courses/:code',
  [
    body('course_name').isString().trim().notEmpty(),
    body('total_weeks').isInt({ min: 1, max: 52 }),
    body('lecturer_ids').isArray({ min: 1 }),
    body('lecturer_ids.*').isInt({ min: 1 }),
    body('min_attendance_pct').optional().isInt({ min: 0, max: 100 }),
  ],
  handleValidation,
  async (req, res) => {
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
      await client.query('DELETE FROM course_lecturers WHERE course_code = $1', [req.params.code]);
      for (const lid of req.body.lecturer_ids) {
        await client.query(
          'INSERT INTO course_lecturers (course_code, lecturer_id) VALUES ($1, $2)',
          [req.params.code, lid]
        );
      }
      await client.query('COMMIT');
      res.json({ course: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Something went wrong.' });
    } finally {
      client.release();
    }
  }
);

router.delete('/courses/:code', async (req, res) => {
  try {
    await pool.query('DELETE FROM courses WHERE course_code = $1', [req.params.code]);
    res.json({ message: 'Course deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ── Classes ──

router.get('/classes', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const count = await pool.query('SELECT COUNT(*) FROM classes');
    const result = await pool.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM student_roster sr WHERE sr.class_id = c.class_id) AS student_count,
              COALESCE(json_agg(json_build_object('id', l.id, 'name', l.name))
                FILTER (WHERE l.id IS NOT NULL), '[]') AS lecturers
       FROM classes c
       LEFT JOIN class_lecturers cl ON cl.class_id = c.class_id
       LEFT JOIN lecturers l ON l.id = cl.lecturer_id
       GROUP BY c.class_id
       ORDER BY c.class_name
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ classes: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.post(
  '/classes',
  [
    body('class_name').isString().trim().notEmpty(),
    body('lecturer_ids').isArray({ min: 1 }),
    body('lecturer_ids.*').isInt({ min: 1 }),
  ],
  handleValidation,
  async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'INSERT INTO classes (class_name) VALUES ($1) RETURNING *',
        [req.body.class_name]
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
      res.status(500).json({ error: 'Something went wrong.' });
    } finally {
      client.release();
    }
  }
);

router.put(
  '/classes/:id',
  [
    body('class_name').isString().trim().notEmpty(),
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
      res.status(500).json({ error: 'Something went wrong.' });
    } finally {
      client.release();
    }
  }
);

router.delete('/classes/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM classes WHERE class_id = $1', [req.params.id]);
    res.json({ message: 'Class deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ── Students ──

router.get('/students', async (req, res) => {
  const { class_id } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  try {
    let result, count;
    if (class_id) {
      count = await pool.query('SELECT COUNT(*) FROM student_roster WHERE class_id = $1', [class_id]);
      result = await pool.query(
        'SELECT * FROM student_roster WHERE class_id = $1 ORDER BY student_name LIMIT $2 OFFSET $3',
        [class_id, limit, offset]
      );
    } else {
      count = await pool.query('SELECT COUNT(*) FROM student_roster');
      result = await pool.query(
        `SELECT sr.*, c.class_name FROM student_roster sr
         JOIN classes c ON c.class_id = sr.class_id
         ORDER BY sr.student_name LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
    }
    res.json({ students: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

router.post(
  '/students',
  [
    body('index_number').isString().trim().notEmpty(),
    body('student_name').isString().trim().notEmpty(),
    body('class_id').isInt({ min: 1 }),
  ],
  handleValidation,
  async (req, res) => {
    const { index_number, student_name, class_id } = req.body;
    try {
      const result = await pool.query(
        'INSERT INTO student_roster (index_number, student_name, class_id) VALUES ($1, $2, $3) RETURNING *',
        [index_number, student_name, class_id]
      );
      res.status(201).json({ student: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Index taken.' });
      console.error(err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  }
);

router.put(
  '/students/:id',
  [
    body('index_number').isString().trim().notEmpty(),
    body('student_name').isString().trim().notEmpty(),
  ],
  handleValidation,
  async (req, res) => {
    const { index_number, student_name } = req.body;
    try {
      const result = await pool.query(
        'UPDATE student_roster SET index_number = $1, student_name = $2 WHERE id = $3 RETURNING *',
        [index_number, student_name, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Student not found.' });
      res.json({ student: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Index taken.' });
      console.error(err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  }
);

router.delete('/students/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM student_roster WHERE id = $1', [req.params.id]);
    res.json({ message: 'Student deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ── CSV Bulk Import Students ──
router.post('/students/bulk', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'CSV file needed.' });
    if (!req.body.class_id) return res.status(400).json({ error: 'Class required.' });

    const classId = parseInt(req.body.class_id);
    const content = req.file.buffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return res.status(400).json({ error: 'CSV needs a header row.' });

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const idxIdx = headers.indexOf('index_number') ?? headers.indexOf('index number') ?? headers.indexOf('index') ?? -1;
    const nameIdx = headers.indexOf('student_name') ?? headers.indexOf('student name') ?? headers.indexOf('name') ?? -1;
    if (idxIdx === -1 || nameIdx === -1) {
      return res.status(400).json({ error: 'CSV needs index_number and student_name columns.' });
    }

    const added = [];
    const errors = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      const indexNumber = cols[idxIdx];
      const studentName = cols[nameIdx];
      if (!indexNumber || !studentName) {
        errors.push({ row: i + 1, error: 'Missing fields.' });
        continue;
      }
      try {
        const result = await pool.query(
          'INSERT INTO student_roster (index_number, student_name, class_id) VALUES ($1, $2, $3) ON CONFLICT (index_number) DO UPDATE SET student_name = $2 RETURNING *',
          [indexNumber, studentName, classId]
        );
        added.push(result.rows[0]);
      } catch (err) {
        errors.push({ row: i + 1, error: err.message });
      }
    }

    res.status(201).json({ added: added.length, errors, students: added });
  } catch (err) {
    console.error('Bulk import error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;
