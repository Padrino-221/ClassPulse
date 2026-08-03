const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, param, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { verifyToken, verifyScope } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../services/mailer');
const { auditLog } = require('../middleware/auditLog');

const router = express.Router();
router.use(verifyToken('admin'));
router.use(verifyScope());

// POST / — Create invitation
router.post('/',
  auditLog('create', 'invitation'),
  [
    body('email').isEmail().normalizeEmail(),
    body('name').isString().trim().isLength({ min: 1, max: 255 }),
    body('password').isString().isLength({ min: 8, max: 128 }),
    body('role').equals('school'),
    body('school_id').isInt({ min: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, name, password, role, school_id } = req.body;
    const { level, university_id } = req.scope;

    if (level !== 'university') {
      return res.status(403).json({ error: 'Only university admins can create school admins.' });
    }

    const targetSchoolId = school_id;

    try {
      // Check if admin with this email already exists
      const existing = await pool.query('SELECT id FROM admins WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'An admin with this email already exists.' });
      }

      // Create the admin directly (skip invitation flow for simplicity)
      const hash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        `INSERT INTO admins (name, email, password_hash, role, university_id, school_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, email, role, university_id, school_id, created_at`,
        [name, email, hash, role, university_id, targetSchoolId]
      );

      const admin = result.rows[0];

      // Generate reset token and send welcome email (fire-and-forget)
      const resetToken = crypto.randomBytes(32).toString('hex');
      pool.query(
        'INSERT INTO password_reset_tokens (user_type, user_id, token) VALUES ($1, $2, $3)',
        ['admin', admin.id, resetToken]
      ).then(() => sendWelcomeEmail(email, name, email, resetToken)).catch(err => {
        console.error('Welcome email failed:', err.message);
      });

      res.status(201).json({ admin });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'An account with this email already exists.' });
      console.error('Create admin error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

// GET / — List admins in scope
router.get('/', async (req, res) => {
  const { level, university_id, school_id, department_id } = req.scope;
  try {
    let query, params;
    if (level === 'university') {
      query = `SELECT id, name, email, role, university_id, school_id, department_id, created_at
               FROM admins WHERE university_id = $1 AND deleted_at IS NULL ORDER BY name`;
      params = [university_id];
    } else if (level === 'school') {
      query = `SELECT id, name, email, role, university_id, school_id, department_id, created_at
               FROM admins WHERE school_id = $1 AND deleted_at IS NULL ORDER BY name`;
      params = [school_id];
    } else {
      return res.status(403).json({ error: "You don't have permission to do this." });
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List admins error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// DELETE /:id — Remove admin
router.delete('/:id',
  auditLog('delete', 'admin'),
  async (req, res) => {
    const { id } = req.params;
    const { level, university_id } = req.scope;
    if (level !== 'university') {
      return res.status(403).json({ error: 'University admin access required.' });
    }
    try {
      const result = await pool.query(
        'DELETE FROM admins WHERE id = $1 AND university_id = $2 AND role != $3 RETURNING id',
        [id, university_id, 'university']
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Admin not found or cannot delete university admins.' });
      }
      res.json({ message: 'Admin deleted.', id: result.rows[0].id });
    } catch (err) {
      console.error('Delete admin error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

module.exports = router;
