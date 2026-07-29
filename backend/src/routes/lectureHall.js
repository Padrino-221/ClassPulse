const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { verifyToken, verifyScope } = require('../middleware/auth');
const sessionCache = require('../services/sessionCache');

const router = express.Router();
router.use(verifyToken('admin'));
router.use(verifyScope());

// List all lecture halls (filtered by university scope)
router.get('/', async (req, res) => {
  try {
    const { university_id } = req.scope;
    let result;
    if (university_id) {
      result = await pool.query('SELECT * FROM lecture_halls WHERE university_id = $1 ORDER BY name', [university_id]);
    } else {
      result = await pool.query('SELECT * FROM lecture_halls ORDER BY name');
    }
    res.json({ lecture_halls: result.rows });
  } catch (err) {
    console.error('List lecture halls error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Create lecture hall
router.post(
  '/',
  [
    body('name').isString().trim().notEmpty(),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('radius').isInt({ min: 10, max: 5000 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, latitude, longitude, radius } = req.body;
    const { university_id } = req.scope;

    try {
      const result = await pool.query(
        'INSERT INTO lecture_halls (name, latitude, longitude, radius, university_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, latitude, longitude, radius, university_id || null]
      );

      sessionCache.setLectureHall(result.rows[0]);
      res.status(201).json({ lecture_hall: result.rows[0] });
    } catch (err) {
      console.error('Create lecture hall error:', err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  }
);

// Update lecture hall
router.put(
  '/:id',
  [
    body('name').optional().isString().trim().notEmpty(),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('radius').optional().isInt({ min: 10, max: 5000 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const fields = [];
    const values = [];
    let idx = 1;

    // Whitelist of allowed field names — prevents SQL injection via dynamic column names
    const ALLOWED_FIELDS = ['name', 'latitude', 'longitude', 'radius'];

    for (const field of ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) {
        fields.push(`${field} = $${idx}`);
        values.push(req.body[field]);
        idx++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(id);

    try {
      const result = await pool.query(
        `UPDATE lecture_halls SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Lecture Hall not found.' });
      }

      sessionCache.setLectureHall(result.rows[0]);
      res.json({ lecture_hall: result.rows[0] });
    } catch (err) {
      console.error('Update lecture hall error:', err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  }
);

// Delete lecture hall
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM lecture_halls WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lecture Hall not found.' });
    }

    sessionCache.lectureHalls.delete(parseInt(req.params.id));
    res.json({ message: 'Lecture Hall deleted.' });
  } catch (err) {
    console.error('Delete lecture hall error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;
