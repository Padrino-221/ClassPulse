const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const sessionCache = require('../services/sessionCache');

const router = express.Router();
router.use(verifyToken('admin'));

// List all buildings
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM buildings ORDER BY name');
    res.json({ buildings: result.rows });
  } catch (err) {
    console.error('List buildings error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Create building
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
        'INSERT INTO buildings (name, latitude, longitude, radius) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, latitude, longitude, radius]
      );

      sessionCache.setBuilding(result.rows[0]);
      res.status(201).json({ building: result.rows[0] });
    } catch (err) {
      console.error('Create building error:', err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  }
);

// Update building
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
        `UPDATE buildings SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Building not found.' });
      }

      sessionCache.setBuilding(result.rows[0]);
      res.json({ building: result.rows[0] });
    } catch (err) {
      console.error('Update building error:', err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  }
);

// Delete building
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM buildings WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Building not found.' });
    }

    sessionCache.buildings.delete(parseInt(req.params.id));
    res.json({ message: 'Building deleted.' });
  } catch (err) {
    console.error('Delete building error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

module.exports = router;
