const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { sendResetEmail } = require('../services/mailer');
const { verifyToken } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const router = express.Router();

// ── Safe table name lookup ──
const USER_TABLES = {
  lecturer: { table: 'lecturers', checkRole: 'lecturer' },
  admin: { table: 'admins', checkRole: 'admin' },
};

function resolveTable(role) {
  const entry = USER_TABLES[role];
  if (!entry) throw new Error(`Invalid role: ${role}`);
  return entry.table;
}

// ── Rate limiter for login ──
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: 'Too many requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many reset attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const changePasswordLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many password change attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('Enter a valid email address.').normalizeEmail().isLength({ max: 255 }),
    body('password').isString().isLength({ min: 1, max: 128 }).withMessage('Enter your password.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      let user = await pool.query(
        'SELECT id, name, email, password_hash, \'lecturer\' AS role FROM lecturers WHERE email = $1 AND (deleted_at IS NULL)',
        [email]
      );

      if (user.rows.length === 0) {
        user = await pool.query(
          `SELECT id, name, email, password_hash, 'admin' AS role,
                  role AS admin_level, university_id, school_id, department_id
           FROM admins WHERE email = $1 AND (deleted_at IS NULL)`,
          [email]
        );
      }

      if (user.rows.length === 0) {
        return res.status(401).json({ error: 'Wrong email or password.' });
      }

      const valid = await bcrypt.compare(password, user.rows[0].password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Wrong email or password.' });
      }

      const { id, name, role, admin_level, university_id, school_id, department_id } = user.rows[0];
      const tokenPayload = { id, name, email, role };
      if (role === 'admin') {
        tokenPayload.admin_level = admin_level || 'university';
        tokenPayload.university_id = university_id;
        tokenPayload.school_id = school_id;
        tokenPayload.department_id = department_id;
      }
      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
      );

      const userResponse = { id, name, email, role };
      if (role === 'admin') {
        userResponse.admin_level = admin_level || 'university';
        userResponse.university_id = university_id;
        userResponse.school_id = school_id;
        userResponse.department_id = department_id;

        // Fetch institution name based on admin level
        try {
          if (admin_level === 'university' && university_id) {
            const uRes = await pool.query('SELECT name FROM universities WHERE id = $1', [university_id]);
            if (uRes.rows.length) userResponse.institution_name = uRes.rows[0].name;
          } else if (admin_level === 'school' && school_id) {
            const sRes = await pool.query('SELECT name FROM schools WHERE id = $1', [school_id]);
            if (sRes.rows.length) userResponse.institution_name = sRes.rows[0].name;
          } else if (admin_level === 'department' && department_id) {
            const dRes = await pool.query('SELECT name FROM departments WHERE id = $1', [department_id]);
            if (dRes.rows.length) userResponse.institution_name = dRes.rows[0].name;
          }
        } catch { /* ignore — optional field */ }
      }
      res.json({ token, user: userResponse });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

router.post(
  '/forgot-password',
  forgotLimiter,
  [body('email').isEmail().withMessage('Enter a valid email address.').normalizeEmail()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    try {
      let userType = 'lecturer';
      let user = await pool.query('SELECT id, email FROM lecturers WHERE email = $1', [email]);

      if (user.rows.length === 0) {
        userType = 'admin';
        user = await pool.query('SELECT id, email FROM admins WHERE email = $1', [email]);
      }

      if (user.rows.length === 0) {
        return res.json({ message: 'If the email exists, a reset link has been sent.' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      await pool.query(
        'INSERT INTO password_reset_tokens (user_type, user_id, token) VALUES ($1, $2, $3)',
        [userType, user.rows[0].id, token]
      );

      try {
        await sendResetEmail(email, token, userType);
      } catch (emailErr) {
        console.error('Failed to send reset email:', emailErr.message);
      }
      res.json({ message: 'If the email exists, a reset link has been sent.' });
    } catch (err) {
      console.error('Forgot password error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

router.post(
  '/reset-password',
  resetLimiter,
  [
    body('token').isString().notEmpty().withMessage('Reset token is required.'),
    body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Password must be at least 8 characters.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, password } = req.body;

    try {
      const result = await pool.query(
        'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = FALSE AND expires_at > NOW()',
        [token]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired reset token.' });
      }

      const rt = result.rows[0];
      const hashedPassword = await bcrypt.hash(password, 10);

      const table = resolveTable(rt.user_type);
      await pool.query(`UPDATE ${table} SET password_hash = $1 WHERE id = $2`, [hashedPassword, rt.user_id]);
      await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [rt.id]);

      res.json({ message: 'Password reset. Sign in with your new password.' });
    } catch (err) {
      console.error('Reset password error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

// ── Profile ──

function institutionInfo(user) {
  if (user.role !== 'admin') return null;
  const { admin_level, university_id, school_id, department_id } = user;
  if (admin_level === 'university' && university_id) {
    return { table: 'universities', id: university_id };
  }
  if (admin_level === 'school' && school_id) {
    return { table: 'schools', id: school_id };
  }
  if (admin_level === 'department' && department_id) {
    return { table: 'departments', id: department_id };
  }
  return null;
}

async function fetchInstitutionName(user) {
  const info = institutionInfo(user);
  if (!info) return null;
  try {
    const res = await pool.query(`SELECT name FROM ${info.table} WHERE id = $1`, [info.id]);
    return res.rows[0]?.name ?? null;
  } catch {
    return null;
  }
}

router.get('/profile', verifyToken(), async (req, res) => {
  try {
    const table = resolveTable(req.user.role);
    const result = await pool.query(
      `SELECT id, name, email, created_at FROM ${table} WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    const user = { ...result.rows[0], role: req.user.role };
    if (req.user.role === 'admin') {
      user.admin_level = req.user.admin_level;
      user.institution_name = await fetchInstitutionName(req.user);
    }
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

router.put(
  '/profile',
  verifyToken(),
  [
    body('name').isString().trim().isLength({ min: 1, max: 255 }).notEmpty(),
    body('email').isEmail().normalizeEmail().isLength({ max: 255 }),
    body('institution_name').optional().isString().trim().isLength({ min: 1, max: 255 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const table = resolveTable(req.user.role);
      const result = await pool.query(
        `UPDATE ${table} SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email, created_at`,
        [req.body.name, req.body.email, req.user.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
      const user = { ...result.rows[0], role: req.user.role };

      if (req.body.institution_name && req.user.role === 'admin') {
        const info = institutionInfo(req.user);
        if (info) {
          await pool.query(`UPDATE ${info.table} SET name = $1 WHERE id = $2`, [
            req.body.institution_name,
            info.id,
          ]);
        }
        user.admin_level = req.user.admin_level;
        user.institution_name = req.body.institution_name;
      }

      const tokenPayload = { id: user.id, name: user.name, email: user.email, role: req.user.role };
      if (req.user.role === 'admin') {
        tokenPayload.admin_level = req.user.admin_level;
        tokenPayload.university_id = req.user.university_id;
        tokenPayload.school_id = req.user.school_id;
        tokenPayload.department_id = req.user.department_id;
      }
      const token = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
      );
      res.json({ user, token });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'An account with this email already exists.' });
      console.error(err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

router.put(
  '/change-password',
  changePasswordLimiter,
  verifyToken(),
  [
    body('current_password').isString().notEmpty().withMessage('Enter your current password.'),
    body('new_password').isString().isLength({ min: 8, max: 128 }).withMessage('Password must be at least 8 characters.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const table = resolveTable(req.user.role);
      const result = await pool.query(
        `SELECT password_hash FROM ${table} WHERE id = $1`,
        [req.user.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });

      const valid = await bcrypt.compare(req.body.current_password, result.rows[0].password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

      const hash = await bcrypt.hash(req.body.new_password, 10);
      await pool.query(`UPDATE ${table} SET password_hash = $1 WHERE id = $2`, [hash, req.user.id]);
      res.json({ message: 'Password changed successfully.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

module.exports = router;
