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

// GET / — List schools in admin's university
router.get('/', async (req, res) => {
  const { university_id } = req.scope;
  if (!university_id) {
    return res.status(403).json({ error: 'University scope required.' });
  }
  try {
    const result = await pool.query(
      `SELECT s.id, s.name, s.code, s.created_at,
              (SELECT COUNT(*) FROM departments d WHERE d.school_id = s.id) AS department_count
       FROM schools s
       WHERE s.university_id = $1
       ORDER BY s.name`,
      [university_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List schools error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// POST / — Create school (university admin only) with school admin
router.post('/', [
  body('name').isString().trim().isLength({ min: 1, max: 255 }),
  body('code').isString().trim().isLength({ min: 1, max: 50 }),
  body('admin_email').isEmail().normalizeEmail(),
  body('admin_name').isString().trim().isLength({ min: 1, max: 255 }),
  body('admin_password').isString().isLength({ min: 8, max: 128 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  if (req.scope.level !== 'university') {
    return res.status(403).json({ error: 'University admin access required.' });
  }
  const { name, code, admin_email, admin_name, admin_password } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const schoolResult = await client.query(
      'INSERT INTO schools (name, code, university_id) VALUES ($1, $2, $3) RETURNING id, name, code, created_at',
      [name, code, req.scope.university_id]
    );
    const school = schoolResult.rows[0];

    const hash = await bcrypt.hash(admin_password, 10);
    const adminResult = await client.query(
      `INSERT INTO admins (name, email, password_hash, role, university_id, school_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, school_id, created_at`,
      [admin_name, admin_email, hash, 'school', req.scope.university_id, school.id]
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

    res.status(201).json({ school, admin });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      const detail = err.constraint?.includes('email') ? 'admin' : 'school';
      return res.status(409).json({ error: `${detail === 'admin' ? 'An admin with this email already exists.' : 'School code already exists in this university.'}` });
    }
    console.error('Create school error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  } finally {
    client.release();
  }
});

// PUT /:id — Update school
router.put('/:id', [
  param('id').isInt({ min: 1 }),
  body('name').optional().isString().trim().isLength({ min: 1, max: 255 }),
  body('code').optional().isString().trim().isLength({ min: 1, max: 50 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  if (req.scope.level !== 'university') {
    return res.status(403).json({ error: 'University admin access required.' });
  }
  const { id } = req.params;
  const fields = [];
  const values = [];
  let idx = 1;
  if (req.body.name !== undefined) { fields.push(`name = $${idx++}`); values.push(req.body.name); }
  if (req.body.code !== undefined) { fields.push(`code = $${idx++}`); values.push(req.body.code); }
  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update.' });
  values.push(id, req.scope.university_id);
  try {
    const result = await pool.query(
      `UPDATE schools SET ${fields.join(', ')} WHERE id = $${idx} AND university_id = $${idx + 1} RETURNING id, name, code, created_at`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'School not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'School code already exists.' });
    console.error('Update school error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// DELETE /:id — Delete school (cascades to departments)
router.delete('/:id', [
  param('id').isInt({ min: 1 }),
], async (req, res) => {
  if (req.scope.level !== 'university') {
    return res.status(403).json({ error: 'University admin access required.' });
  }
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM schools WHERE id = $1 AND university_id = $2 RETURNING id',
      [id, req.scope.university_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'School not found.' });
    res.json({ message: 'School deleted.', id: result.rows[0].id });
  } catch (err) {
    console.error('Delete school error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;
