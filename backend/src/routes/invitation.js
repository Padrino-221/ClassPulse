const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { verifyToken, verifyScope } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../services/mailer');
const { auditLog } = require('../middleware/auditLog');

const router = express.Router();
router.use(verifyToken('admin'));
router.use(verifyScope());

// POST / — Create invitation (school or department admin)
router.post('/',
  auditLog('create', 'invitation'),
  [
    body('email').isEmail().normalizeEmail(),
    body('name').isString().trim().isLength({ min: 1, max: 255 }),
    body('password').isString().isLength({ min: 8, max: 128 }),
    body('role').isIn(['school', 'department']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, name, password, role, school_id, department_id } = req.body;
    const { level, university_id, school_id: scopeSchoolId } = req.scope;

    // University admins can create school admins; school admins can create department admins
    if (level === 'university' && role !== 'school') {
      return res.status(403).json({ error: 'University admins can only create school admins.' });
    }
    if (level === 'school' && role !== 'department') {
      return res.status(403).json({ error: 'School admins can only create department admins.' });
    }
    if (level === 'department') {
      return res.status(403).json({ error: 'Department admins cannot create other admins.' });
    }

    let targetSchoolId = null;
    let targetDepartmentId = null;

    try {
      if (role === 'school') {
        if (!school_id) {
          return res.status(400).json({ error: 'school_id is required for school admin creation.' });
        }
        // Validate school belongs to this university
        const schoolCheck = await pool.query('SELECT id FROM schools WHERE id = $1 AND university_id = $2 AND deleted_at IS NULL', [school_id, university_id]);
        if (schoolCheck.rows.length === 0) {
          return res.status(400).json({ error: 'School does not belong to your university.' });
        }
        targetSchoolId = school_id;
      } else {
        if (!department_id) {
          return res.status(400).json({ error: 'department_id is required for department admin creation.' });
        }
        // Validate department belongs to this school
        const deptCheck = await pool.query('SELECT id FROM departments WHERE id = $1 AND school_id = $2 AND deleted_at IS NULL', [department_id, scopeSchoolId]);
        if (deptCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Department does not belong to your school.' });
        }
        targetSchoolId = scopeSchoolId;
        targetDepartmentId = department_id;
      }

      // Check if admin with this email already exists
      const existing = await pool.query('SELECT id FROM admins WHERE email = $1 AND deleted_at IS NULL', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'An admin with this email already exists.' });
      }

      // Create the admin directly (skip invitation flow for simplicity)
      const hash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        `INSERT INTO admins (name, email, password_hash, role, university_id, school_id, department_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, email, role, university_id, school_id, department_id, created_at`,
        [name, email, hash, role, university_id, targetSchoolId, targetDepartmentId]
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
      query = `SELECT a.id, a.name, a.email, a.role, a.university_id, a.school_id, a.department_id, a.created_at,
                      sc.name AS school_name, d.name AS department_name
               FROM admins a
               LEFT JOIN schools sc ON sc.id = a.school_id AND sc.deleted_at IS NULL
               LEFT JOIN departments d ON d.id = a.department_id AND d.deleted_at IS NULL
               WHERE a.university_id = $1 AND a.deleted_at IS NULL ORDER BY a.name`;
      params = [university_id];
    } else if (level === 'school') {
      query = `SELECT a.id, a.name, a.email, a.role, a.university_id, a.school_id, a.department_id, a.created_at,
                      sc.name AS school_name, d.name AS department_name
               FROM admins a
               LEFT JOIN schools sc ON sc.id = a.school_id AND sc.deleted_at IS NULL
               LEFT JOIN departments d ON d.id = a.department_id AND d.deleted_at IS NULL
               WHERE a.school_id = $1 AND a.role = 'department' AND a.deleted_at IS NULL ORDER BY a.name`;
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

// PUT /:id/reassign — Reassign an admin to a different school or department
router.put('/:id/reassign',
  auditLog('update', 'admin'),
  [
    body('school_id').optional().isInt({ min: 1 }),
    body('department_id').optional().isInt({ min: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    const { level, university_id, school_id: scopeSchoolId } = req.scope;
    const { school_id, department_id } = req.body;

    if (level !== 'university' && level !== 'school') {
      return res.status(403).json({ error: 'University or school admin access required.' });
    }

    try {
      // Fetch the target admin
      const adminCheck = await pool.query(
        'SELECT id, role, school_id, department_id FROM admins WHERE id = $1 AND university_id = $2 AND deleted_at IS NULL',
        [id, university_id]
      );
      if (adminCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Admin not found.' });
      }
      const admin = adminCheck.rows[0];
      if (admin.role === 'university') {
        return res.status(400).json({ error: 'Cannot reassign university admins.' });
      }

      let newSchoolId = admin.school_id;
      let newDepartmentId = admin.department_id;

      if (admin.role === 'school') {
        if (!school_id) {
          return res.status(400).json({ error: 'school_id is required for school admin reassignment.' });
        }
        const schoolCheck = await pool.query(
          'SELECT id FROM schools WHERE id = $1 AND university_id = $2 AND deleted_at IS NULL',
          [school_id, university_id]
        );
        if (schoolCheck.rows.length === 0) {
          return res.status(400).json({ error: 'School not found in your university.' });
        }
        newSchoolId = school_id;
        newDepartmentId = null;
      } else if (admin.role === 'department') {
        if (!department_id) {
          return res.status(400).json({ error: 'department_id is required for department admin reassignment.' });
        }
        const deptCheck = await pool.query(
          `SELECT d.id, d.school_id FROM departments d
           JOIN schools s ON s.id = d.school_id AND s.deleted_at IS NULL
           WHERE d.id = $1 AND s.university_id = $2 AND d.deleted_at IS NULL`,
          [department_id, university_id]
        );
        if (deptCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Department not found in your university.' });
        }
        // School admins can only reassign within their school
        if (level === 'school' && String(deptCheck.rows[0].school_id) !== String(scopeSchoolId)) {
          return res.status(403).json({ error: 'Department does not belong to your school.' });
        }
        newSchoolId = deptCheck.rows[0].school_id;
        newDepartmentId = department_id;
      }

      const result = await pool.query(
        `UPDATE admins SET school_id = $1, department_id = $2 WHERE id = $3 RETURNING id, name, email, role, school_id, department_id`,
        [newSchoolId, newDepartmentId, id]
      );

      res.json({ admin: result.rows[0] });
    } catch (err) {
      console.error('Reassign admin error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

// PUT /:id — Update admin details (name, email, password)
router.put('/:id',
  auditLog('update', 'admin'),
  [
    body('name').optional().isString().trim().isLength({ min: 1, max: 255 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('password').optional().isString().isLength({ min: 8, max: 128 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    const { level, university_id, school_id } = req.scope;
    const { name, email, password } = req.body;

    if (level !== 'university' && level !== 'school') {
      return res.status(403).json({ error: 'University or school admin access required.' });
    }

    try {
      // Fetch the target admin
      const adminCheck = await pool.query(
        'SELECT id, role, school_id, email FROM admins WHERE id = $1 AND university_id = $2 AND deleted_at IS NULL',
        [id, university_id]
      );
      if (adminCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Admin not found.' });
      }
      const target = adminCheck.rows[0];
      if (target.role === 'university') {
        return res.status(403).json({ error: 'Cannot edit university admins.' });
      }
      if (level === 'school' && (target.role !== 'department' || String(target.school_id) !== String(school_id))) {
        return res.status(403).json({ error: 'You can only edit department admins in your school.' });
      }

      // Check email uniqueness if changing
      if (email && email !== target.email) {
        const emailCheck = await pool.query(
          'SELECT id FROM admins WHERE email = $1 AND deleted_at IS NULL AND id != $2',
          [email, id]
        );
        if (emailCheck.rows.length > 0) {
          return res.status(409).json({ error: 'An admin with this email already exists.' });
        }
      }

      const fields = [];
      const values = [];
      let idx = 1;
      if (name) { fields.push(`name = $${idx++}`); values.push(name); }
      if (email) { fields.push(`email = $${idx++}`); values.push(email); }
      if (password) {
        const hash = await bcrypt.hash(password, 10);
        fields.push(`password_hash = $${idx++}`);
        values.push(hash);
      }
      if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update.' });
      }

      values.push(id);
      const result = await pool.query(
        `UPDATE admins SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, email, role, school_id, department_id`,
        values
      );

      res.json({ admin: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'An admin with this email already exists.' });
      console.error('Update admin error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

// DELETE /:id — Remove admin
router.delete('/:id',
  auditLog('delete', 'admin'),
  async (req, res) => {
    const { id } = req.params;
    const { level, university_id, school_id } = req.scope;
    if (level !== 'university' && level !== 'school') {
      return res.status(403).json({ error: 'University or school admin access required.' });
    }
    try {
      // Fetch the target admin to verify scope
      const adminCheck = await pool.query(
        'SELECT id, role, school_id FROM admins WHERE id = $1 AND university_id = $2 AND deleted_at IS NULL',
        [id, university_id]
      );
      if (adminCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Admin not found.' });
      }
      const target = adminCheck.rows[0];
      if (target.role === 'university') {
        return res.status(403).json({ error: 'Cannot delete university admins.' });
      }
      if (level === 'school' && (target.role !== 'department' || String(target.school_id) !== String(school_id))) {
        return res.status(403).json({ error: 'You can only delete department admins in your school.' });
      }

      const result = await pool.query(
        'DELETE FROM admins WHERE id = $1 AND university_id = $2 AND role != $3 RETURNING id',
        [id, university_id, 'university']
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Admin not found.' });
      }
      res.json({ message: 'Admin deleted.', id: result.rows[0].id });
    } catch (err) {
      console.error('Delete admin error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

module.exports = router;
