const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const sessionCache = require('../services/sessionCache');

const router = express.Router();
router.use(verifyToken('admin'));

// List all campuses
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM campuses ORDER BY name');
    res.json({ campuses: result.rows });
  } catch (err) {
    console.error('List campuses error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Create campus
router.post(
  '/',
  [
    body('name').isString().trim().notEmpty(),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('radius').isInt({ min: 100, max: 5000 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, latitude, longitude, radius } = req.body;

    try {
      const result = await pool.query(
        'INSERT INTO campuses (name, latitude, longitude, radius) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, latitude, longitude, radius]
      );

      sessionCache.setCampus(result.rows[0]);
      res.status(201).json({ campus: result.rows[0] });
    } catch (err) {
      console.error('Create campus error:', err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  }
);

// Update campus
router.put(
  '/:id',
  [
    body('name').optional().isString().trim().notEmpty(),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('radius').optional().isInt({ min: 100, max: 5000 }),
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

    for (const field of ['name', 'latitude', 'longitude', 'radius']) {
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
        `UPDATE campuses SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Campus not found.' });
      }

      sessionCache.setCampus(result.rows[0]);
      res.json({ campus: result.rows[0] });
    } catch (err) {
      console.error('Update campus error:', err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  }
);

// Delete campus
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM campuses WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campus not found.' });
    }

    sessionCache.campuses.delete(parseInt(req.params.id));
    res.json({ message: 'Campus deleted.' });
  } catch (err) {
    console.error('Delete campus error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;
