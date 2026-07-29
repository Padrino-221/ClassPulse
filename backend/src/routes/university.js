const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { verifyToken, verifyScope } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken('admin'));
router.use(verifyScope());

// GET / — List universities (university admin only)
router.get('/', async (req, res) => {
  if (req.scope.level !== 'university') {
    return res.status(403).json({ error: 'University admin access required.' });
  }
  try {
    const result = await pool.query(
      'SELECT id, name, code, created_at FROM universities ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List universities error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// POST / — Create university
router.post('/', [
  body('name').isString().trim().isLength({ min: 1, max: 255 }),
  body('code').isString().trim().isLength({ min: 1, max: 50 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  if (req.scope.level !== 'university') {
    return res.status(403).json({ error: 'University admin access required.' });
  }
  const { name, code } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO universities (name, code) VALUES ($1, $2) RETURNING id, name, code, created_at',
      [name, code]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'University code already exists.' });
    }
    console.error('Create university error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// GET /:id — Get university by ID (university admin only)
router.get('/:id', [
  param('id').isInt({ min: 1 }),
], async (req, res) => {
  if (req.scope.level !== 'university') {
    return res.status(403).json({ error: 'University admin access required.' });
  }
  try {
    const result = await pool.query(
      'SELECT id, name, code, created_at FROM universities WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'University not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get university error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// PUT /:id — Update university (university admin only)
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
  values.push(id);
  try {
    const result = await pool.query(
      `UPDATE universities SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, code, created_at`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'University not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'University code already exists.' });
    console.error('Update university error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;
