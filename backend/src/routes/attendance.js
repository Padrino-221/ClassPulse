const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { isWithinRange } = require('../services/haversine');
const { hashDeviceFingerprint } = require('../services/fingerprint');
const { validatePin } = require('../services/pin');
const { verifyToken } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const sessionCache = require('../services/sessionCache');

const router = express.Router();

const attendanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 100 : 5,
  message: { error: 'Too many attempts. Wait.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ---- POST /check-in ----
// Campus geofence + rolling PIN. No auth required for students.
router.post(
  '/check-in',
  attendanceLimiter,
  [
    body('name').isString().trim().notEmpty(),
    body('index_number').isString().trim().notEmpty(),
    body('course_code').isString().trim().notEmpty(),
    body('pin').isString().trim().isLength({ min: 4, max: 6 }),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('accuracy').isFloat({ min: 0 }),
    body('device_fingerprint').isString().notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, index_number, course_code, pin, latitude, longitude, accuracy, device_fingerprint } = req.body;

    try {
      // 1. Name-to-index validation against roster
      const studentCheck = await pool.query(
        'SELECT student_name FROM student_roster WHERE index_number = $1',
        [index_number]
      );

      if (studentCheck.rows.length > 0) {
        const rosterName = studentCheck.rows[0].student_name.trim().toLowerCase();
        const submittedName = name.trim().toLowerCase();
        if (rosterName !== submittedName) {
          return res.status(400).json({ error: 'Name does not match your index number.' });
        }
      }

      // 2. Rolling PIN validation via cache-first lookup
      const session = sessionCache.findActiveByPinAndCourse(pin, course_code, validatePin);

      if (!session) {
        return res.status(404).json({ error: 'Session not found or expired.' });
      }

      // 3. Campus geofence check
      if (!session.campus_latitude || !session.campus_longitude || !session.campus_radius) {
        console.error(`Session ${session.session_id} has no campus geofence configured.`);
        return res.status(500).json({ error: 'Campus location not configured. Contact your lecturer.' });
      }

      const { within, distance } = isWithinRange(
        parseFloat(latitude),
        parseFloat(longitude),
        session.campus_latitude,
        session.campus_longitude,
        session.campus_radius
      );

      if (!within) {
        console.log(
          `Geofence reject: student ${index_number} is ${distance}m from campus (limit: ${session.campus_radius}m)`
        );
        return res.status(403).json({
          error: `You are ${distance}m from campus. Must be within ${session.campus_radius}m.`,
        });
      }

      // 4. Device fingerprint proxy check
      const fingerprintHash = hashDeviceFingerprint(device_fingerprint);

      const proxyCheck = await pool.query(
        `SELECT COUNT(DISTINCT index_number) AS cnt
         FROM attendance_records
         WHERE device_fingerprint_hash = $1
           AND session_id = $2
           AND index_number != $3`,
        [fingerprintHash, session.session_id, index_number]
      );

      if (parseInt(proxyCheck.rows[0].cnt) > 0) {
        return res.status(429).json({ error: 'Device used for another student.' });
      }

      // 5. Write attendance record
      const insertResult = await pool.query(
        `INSERT INTO attendance_records (session_id, index_number, student_name, verification_method, device_fingerprint_hash, marked_by)
         VALUES ($1, $2, $3, 'GPS', $4, NULL)
         RETURNING record_id, timestamp`,
        [session.session_id, index_number, name, fingerprintHash]
      );

      sessionCache.invalidateMatricesForCourse(session.course_code, session.class_id);

      res.status(201).json({
        message: 'Attendance recorded successfully.',
        record: insertResult.rows[0],
        session_id: session.session_id,
        campus: session.campus_name,
        distance,
      });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Already checked in for this session.' });
      }
      console.error('Check-in error:', err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  }
);

// ---- GET /campus-info ----
// Public endpoint: returns active session campus info for the attend page.
router.get('/campus-info', async (req, res) => {
  const { course_code, pin } = req.query;

  if (!course_code || !pin) {
    return res.status(400).json({ error: 'course_code and pin required.' });
  }

  try {
    const session = sessionCache.findActiveByPinAndCourse(pin, course_code, validatePin);

    if (!session || !session.campus_name) {
      return res.status(404).json({ error: 'No active session found.' });
    }

    res.json({
      campus_name: session.campus_name,
      course_code: session.course_code,
      week_number: session.week_number,
    });
  } catch (err) {
    console.error('Campus info error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---- POST / (legacy) ----
// Kept for backward compatibility. Uses campus geofence when available, falls back to session coords.
router.post(
  '/',
  attendanceLimiter,
  [
    body('name').isString().trim().notEmpty(),
    body('index_number').isString().trim().notEmpty(),
    body('course_code').isString().trim().notEmpty(),
    body('pin').isString().trim().isLength({ min: 4, max: 6 }),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('accuracy').optional().isFloat({ min: 0 }),
    body('device_fingerprint').isString().notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, index_number, course_code, pin, latitude, longitude, accuracy, device_fingerprint } = req.body;

    try {
      const studentCheck = await pool.query(
        'SELECT student_name FROM student_roster WHERE index_number = $1',
        [index_number]
      );

      if (studentCheck.rows.length > 0) {
        const rosterName = studentCheck.rows[0].student_name.trim().toLowerCase();
        const submittedName = name.trim().toLowerCase();
        if (rosterName !== submittedName) {
          return res.status(400).json({ error: 'Name does not match your index number.' });
        }
      }

      const session = sessionCache.findActiveByPinAndCourse(pin, course_code, validatePin);

      if (!session) {
        return res.status(404).json({ error: 'Session not found or expired.' });
      }

      // Use campus geofence if available, otherwise fall back to session coordinates
      const refLat = session.campus_latitude || session.latitude;
      const refLon = session.campus_longitude || session.longitude;
      const refRadius = session.campus_radius || session.radius_meters || 400;

      const { within, distance } = isWithinRange(
        parseFloat(latitude),
        parseFloat(longitude),
        refLat,
        refLon,
        refRadius
      );

      if (!within) {
        return res.status(403).json({ error: `You are too far (${refRadius}m limit).` });
      }

      const fingerprintHash = hashDeviceFingerprint(device_fingerprint);

      const proxyCheck = await pool.query(
        `SELECT COUNT(DISTINCT index_number) AS cnt
         FROM attendance_records
         WHERE device_fingerprint_hash = $1
           AND session_id = $2
           AND index_number != $3`,
        [fingerprintHash, session.session_id, index_number]
      );

      if (parseInt(proxyCheck.rows[0].cnt) > 0) {
        return res.status(429).json({ error: 'Device used for another student.' });
      }

      const insertResult = await pool.query(
        `INSERT INTO attendance_records (session_id, index_number, student_name, verification_method, device_fingerprint_hash, marked_by)
         VALUES ($1, $2, $3, 'GPS', $4, NULL)
         RETURNING record_id, timestamp`,
        [session.session_id, index_number, name, fingerprintHash]
      );

      sessionCache.invalidateMatricesForCourse(session.course_code, session.class_id);

      res.status(201).json({
        message: 'Marked.',
        record: insertResult.rows[0],
        session_id: session.session_id,
      });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Already marked for this session.' });
      }
      console.error('Attendance error:', err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  }
);

// ---- POST /manual ----
// Lecturer manual override. Requires lecturer JWT.
router.post(
  '/manual',
  verifyToken('lecturer'),
  [
    body('session_id').isUUID(),
    body('index_number').isString().trim().notEmpty(),
    body('student_name').isString().trim().notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { session_id, index_number, student_name } = req.body;

    try {
      const cachedSession = sessionCache.get(session_id);
      if (!cachedSession || !cachedSession.is_active) {
        return res.status(404).json({ error: 'Session ended.' });
      }

      const existing = await pool.query(
        'SELECT id FROM student_roster WHERE index_number = $1 AND class_id = $2',
        [index_number, cachedSession.class_id]
      );
      if (existing.rows.length === 0) {
        await pool.query(
          'INSERT INTO student_roster (index_number, student_name, class_id) VALUES ($1, $2, $3)',
          [index_number, student_name, cachedSession.class_id]
        );
      }

      const result = await pool.query(
        `INSERT INTO attendance_records (session_id, index_number, student_name, verification_method, marked_by)
         VALUES ($1, $2, $3, 'MANUAL', $4)
         RETURNING record_id, timestamp`,
        [session_id, index_number, student_name, req.user.id]
      );

      sessionCache.invalidateMatricesForCourse(cachedSession.course_code, cachedSession.class_id);

      res.status(201).json({
        message: 'Manually marked.',
        record: result.rows[0],
      });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Already marked.' });
      }
      console.error('Manual attendance error:', err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  }
);

module.exports = router;
