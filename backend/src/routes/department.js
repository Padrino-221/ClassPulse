const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, param, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { verifyToken, verifyScope } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../services/mailer');

const router = express.Router();
router.use(verifyToken('admin'));
router.use(verifyScope());

// GET / — List departments in admin's scope
router.get('/', async (req, res) => {
  const { level, university_id, school_id, department_id } = req.scope;
  try {
    let query, params;
    if (level === 'university') {
      query = `SELECT d.id, d.name, d.code, d.created_at,
                      s.name AS school_name, s.id AS school_id,
                      (SELECT COUNT(*) FROM courses c WHERE c.department_id = d.id AND c.deleted_at IS NULL) AS course_count,
                      (SELECT COUNT(*) FROM lecturers l WHERE l.department_id = d.id AND l.deleted_at IS NULL) AS lecturer_count
               FROM departments d
               JOIN schools s ON s.id = d.school_id
               WHERE s.university_id = $1 AND d.deleted_at IS NULL
               ORDER BY s.name, d.name`;
      params = [university_id];
    } else if (level === 'school') {
      query = `SELECT d.id, d.name, d.code, d.created_at,
                      s.name AS school_name, s.id AS school_id,
                      (SELECT COUNT(*) FROM courses c WHERE c.department_id = d.id AND c.deleted_at IS NULL) AS course_count,
                      (SELECT COUNT(*) FROM lecturers l WHERE l.department_id = d.id AND l.deleted_at IS NULL) AS lecturer_count
               FROM departments d
               JOIN schools s ON s.id = d.school_id
               WHERE d.school_id = $1 AND d.deleted_at IS NULL
               ORDER BY d.name`;
      params = [school_id];
    } else {
      return res.status(403).json({ error: 'University or school admin access required.' });
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List departments error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// POST / — Create department (university or school admin) with department admin
router.post('/', [
  body('name').isString().trim().isLength({ min: 1, max: 255 }),
  body('code').isString().trim().isLength({ min: 1, max: 50 }),
  body('school_id').optional().isInt({ min: 1 }),
  body('admin_email').isEmail().normalizeEmail(),
  body('admin_name').isString().trim().isLength({ min: 1, max: 255 }),
  body('admin_password').isString().isLength({ min: 8, max: 128 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { level, school_id: scopeSchoolId, university_id } = req.scope;
  if (level === 'department') {
    return res.status(403).json({ error: 'University or school admin access required.' });
  }
  const { name, code, admin_email, admin_name, admin_password } = req.body;
  const targetSchoolId = level === 'school' ? scopeSchoolId : (req.body.school_id || scopeSchoolId);
  if (!targetSchoolId) {
    return res.status(400).json({ error: 'school_id required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const deptResult = await client.query(
      'INSERT INTO departments (name, code, school_id) VALUES ($1, $2, $3) RETURNING id, name, code, created_at',
      [name, code, targetSchoolId]
    );
    const department = deptResult.rows[0];

    const hash = await bcrypt.hash(admin_password, 10);
    const adminResult = await client.query(
      `INSERT INTO admins (name, email, password_hash, role, university_id, school_id, department_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, role, department_id, created_at`,
      [admin_name, admin_email, hash, 'department', university_id, targetSchoolId, department.id]
    );
    const admin = adminResult.rows[0];
    // Generate reset token and send welcome email
    const resetToken = crypto.randomBytes(32).toString('hex');
    await client.query(
      'INSERT INTO password_reset_tokens (user_type, user_id, token) VALUES ($1, $2, $3)',
      ['admin', admin.id, resetToken]
    );
    sendWelcomeEmail(admin_email, admin_name, admin_email, resetToken).catch(err => {
      console.error('Welcome email failed:', err.message);
    });

    await client.query('COMMIT');

    res.status(201).json({ department, admin });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      const detail = err.constraint?.includes('email') ? 'admin' : 'department';
      return res.status(409).json({ error: `${detail === 'admin' ? 'An admin with this email already exists.' : 'Department code already exists in this school.'}` });
    }
    console.error('Create department error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  } finally {
    client.release();
  }
});

// PUT /:id — Update department
router.put('/:id', [
  param('id').isInt({ min: 1 }),
  body('name').optional().isString().trim().isLength({ min: 1, max: 255 }),
  body('code').optional().isString().trim().isLength({ min: 1, max: 50 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { id } = req.params;
  const { level, school_id } = req.scope;
  if (level === 'department') {
    return res.status(403).json({ error: 'University or school admin access required.' });
  }
  const fields = [];
  const values = [];
  let idx = 1;
  if (req.body.name !== undefined) { fields.push(`name = $${idx++}`); values.push(req.body.name); }
  if (req.body.code !== undefined) { fields.push(`code = $${idx++}`); values.push(req.body.code); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update.' });

  // Scope check: school admin can only update departments in their school
  let whereClause = `id = $${idx++}`;
  values.push(id);
  if (level === 'school') {
    whereClause += ` AND school_id = $${idx++}`;
    values.push(school_id);
  }

  try {
    const result = await pool.query(
      `UPDATE departments SET ${fields.join(', ')} WHERE ${whereClause} RETURNING id, name, code, created_at`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Department not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Department code already exists.' });
    console.error('Update department error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// DELETE /:id — Soft-delete department and cascade to courses, classes, lecturers
router.delete('/:id', [
  param('id').isInt({ min: 1 }),
], async (req, res) => {
  const { level, school_id } = req.scope;
  if (level === 'department') {
    return res.status(403).json({ error: 'University or school admin access required.' });
  }
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cascade soft-delete to children
    await client.query('UPDATE lecturers SET deleted_at = NOW() WHERE department_id = $1 AND deleted_at IS NULL', [id]);
    await client.query('UPDATE courses SET deleted_at = NOW() WHERE department_id = $1 AND deleted_at IS NULL', [id]);
    await client.query('UPDATE classes SET deleted_at = NOW() WHERE department_id = $1 AND deleted_at IS NULL', [id]);
    await client.query(
      `UPDATE active_sessions SET is_active = FALSE
       WHERE course_id IN (SELECT c.id FROM courses c WHERE c.department_id = $1)
         AND is_active = TRUE`,
      [id]
    );

    let whereClause = 'id = $1 AND deleted_at IS NULL';
    const params = [id];
    if (level === 'school') {
      whereClause += ' AND school_id = $2';
      params.push(school_id);
    }
    const result = await client.query(
      `UPDATE departments SET deleted_at = NOW() WHERE ${whereClause} RETURNING id`,
      params
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Department not found.' });
    }
    await client.query('COMMIT');
    res.json({ message: 'Department deleted.', id: result.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete department error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  } finally {
    client.release();
  }
});

module.exports = router;
