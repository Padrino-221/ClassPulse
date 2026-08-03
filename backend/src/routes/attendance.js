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

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function namesMatch(submitted, roster) {
  const a = normalizeName(submitted);
  const b = normalizeName(roster);
  if (a === b) return true;
  const aWords = a.split(' ').filter(Boolean).sort();
  const bWords = b.split(' ').filter(Boolean).sort();
  return aWords.length === bWords.length && aWords.every((w, i) => w === bWords[i]);
}

const attendanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 100 : 5,
  message: { error: 'Too many attempts. Wait.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ---- POST /validate-pin ----
// Validate a session PIN without requiring GPS. Used by the attend page to validate before acquiring location.
const validatePinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 100 : 5,
  message: { error: 'Too many PIN attempts. Wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/validate-pin',
  validatePinLimiter,
  [
    body('pin').isString().trim().isLength({ min: 4, max: 30 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { pin: submittedPin } = req.body;

    const dashIndex = submittedPin.indexOf('-');
    let course_code, numericPin;
    if (dashIndex > 0) {
      course_code = submittedPin.substring(0, dashIndex);
      numericPin = submittedPin.substring(dashIndex + 1);
    } else {
      course_code = null;
      numericPin = submittedPin;
    }

    try {
      const session = sessionCache.findActiveByPinAndCourse(numericPin, course_code, validatePin);

      if (!session) {
        return res.status(404).json({ error: 'Session not found or expired.' });
      }

      res.json({
        valid: true,
        course_code: session.course_code,
        course_name: session.course_name,
        class_name: session.class_name,
        lecture_hall_name: session.lecture_hall_name,
        week_number: session.week_number,
      });
    } catch (err) {
      console.error('Validate pin error:', err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  }
);

// ---- POST /check-in ----
// Lecture hall geofence + rolling PIN. No auth required for students.
router.post(
  '/check-in',
  attendanceLimiter,
  [
    body('name').isString().trim().isLength({ min: 1, max: 255 }).notEmpty(),
    body('index_number').isString().trim().isLength({ min: 1, max: 50 }).notEmpty(),
    body('pin').isString().trim().isLength({ min: 4, max: 30 }),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('accuracy').optional().isFloat({ min: 0 }),
    body('device_fingerprint').isString().isLength({ min: 1, max: 512 }).notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, index_number, pin: submittedPin, latitude, longitude, accuracy, device_fingerprint } = req.body;

    // Parse pin prefix: "CS101-482916" → courseCode="CS101", numericPin="482916"
    const dashIndex = submittedPin.indexOf('-');
    let course_code, numericPin;
    if (dashIndex > 0) {
      course_code = submittedPin.substring(0, dashIndex);
      numericPin = submittedPin.substring(dashIndex + 1);
    } else {
      // Fallback: no dash, treat entire pin as numeric (backward compat)
      course_code = null;
      numericPin = submittedPin;
    }

    try {
      // 0. Reject poor accuracy readings (only if provided)
      if (accuracy !== undefined && parseFloat(accuracy) > 100) {
        return res.status(400).json({ error: `GPS accuracy is too low (${Math.round(parseFloat(accuracy))}m). Move outdoors or near a window.` });
      }

      // 1. Name-to-index validation against roster
      const studentCheck = await pool.query(
        'SELECT student_name FROM student_roster WHERE index_number = $1 AND deleted_at IS NULL',
        [index_number]
      );

      if (studentCheck.rows.length > 0) {
        const rosterName = studentCheck.rows[0].student_name;
        if (!namesMatch(name, rosterName)) {
          return res.status(400).json({ error: 'Name does not match your index number.' });
        }
      }

      // 2. Rolling PIN validation via cache-first lookup
      const session = sessionCache.findActiveByPinAndCourse(numericPin, course_code, validatePin);

      if (!session) {
        return res.status(404).json({ error: 'Session not found or expired.' });
      }

      // 3. Lecture hall geofence check
      if (!session.lecture_hall_latitude || !session.lecture_hall_longitude || !session.lecture_hall_radius) {
        console.error(`Session ${session.session_id} has no lecture hall geofence configured.`);
        return res.status(500).json({ error: 'Lecture hall location not configured. Contact your lecturer.' });
      }

      const { within, distance } = isWithinRange(
        parseFloat(latitude),
        parseFloat(longitude),
        session.lecture_hall_latitude,
        session.lecture_hall_longitude,
        session.lecture_hall_radius
      );

      if (!within) {
        console.log(
          `Geofence reject: student ${index_number} is ${distance}m from lecture hall (limit: ${session.lecture_hall_radius}m)`
        );
        return res.status(403).json({
          error: `You are ${distance}m from the lecture hall. Must be within ${session.lecture_hall_radius}m.`,
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
        `INSERT INTO attendance_records (session_id, index_number, verification_method, device_fingerprint_hash, marked_by)
         VALUES ($1, $2, 'GPS', $3, NULL)
         RETURNING record_id, timestamp`,
        [session.session_id, index_number, fingerprintHash]
      );

      sessionCache.invalidateMatricesForCourse(session.course_code, session.class_id);

      res.status(201).json({
        message: 'Attendance recorded successfully.',
        record: insertResult.rows[0],
        session_id: session.session_id,
        lecture_hall: session.lecture_hall_name,
        distance,
      });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Already checked in for this session.' });
      }
      if (err.code === '23503') {
        return res.status(404).json({ error: 'Session not found or has expired.' });
      }
      console.error('Check-in error:', err);
      res.status(500).json({ error: 'Something went wrong.' });
    }
  }
);

// ---- GET /hall-info ----
// Public endpoint: returns active session lecture hall info for the attend page.
const hallInfoLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/hall-info', hallInfoLimiter, async (req, res) => {
  const { pin: submittedPin } = req.query;

  if (!submittedPin) {
    return res.status(400).json({ error: 'pin required.' });
  }

  // Parse pin prefix: "CS101-482916" → courseCode="CS101", numericPin="482916"
  const dashIndex = submittedPin.indexOf('-');
  let course_code, numericPin;
  if (dashIndex > 0) {
    course_code = submittedPin.substring(0, dashIndex);
    numericPin = submittedPin.substring(dashIndex + 1);
  } else {
    course_code = null;
    numericPin = submittedPin;
  }

  try {
    const session = sessionCache.findActiveByPinAndCourse(numericPin, course_code, validatePin);

    if (!session || !session.lecture_hall_name) {
      return res.status(404).json({ error: 'No active session found.' });
    }

    res.json({
      lecture_hall_name: session.lecture_hall_name,
      course_code: session.course_code,
      week_number: session.week_number,
    });
  } catch (err) {
    console.error('Hall info error:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ---- POST / (legacy) ----
// Kept for backward compatibility. Uses lecture hall geofence when available, falls back to session coords.
router.post(
  '/',
  attendanceLimiter,
  [
    body('name').isString().trim().isLength({ min: 1, max: 255 }).notEmpty(),
    body('index_number').isString().trim().isLength({ min: 1, max: 50 }).notEmpty(),
    body('pin').isString().trim().isLength({ min: 4, max: 30 }),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('accuracy').optional().isFloat({ min: 0 }),
    body('device_fingerprint').isString().isLength({ min: 1, max: 512 }).notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, index_number, pin: submittedPin, latitude, longitude, accuracy, device_fingerprint } = req.body;

    // Parse pin prefix
    const dashIndex = submittedPin.indexOf('-');
    let course_code, numericPin;
    if (dashIndex > 0) {
      course_code = submittedPin.substring(0, dashIndex);
      numericPin = submittedPin.substring(dashIndex + 1);
    } else {
      course_code = null;
      numericPin = submittedPin;
    }

    try {
      // Reject poor accuracy readings (GPS > 100m is unreliable) — only if provided
      if (accuracy !== undefined && parseFloat(accuracy) > 100) {
        return res.status(400).json({ error: `GPS accuracy is too low (${Math.round(parseFloat(accuracy))}m). Move outdoors or near a window.` });
      }

      const studentCheck = await pool.query(
        'SELECT student_name FROM student_roster WHERE index_number = $1 AND deleted_at IS NULL',
        [index_number]
      );

      if (studentCheck.rows.length > 0) {
        const rosterName = studentCheck.rows[0].student_name;
        if (!namesMatch(name, rosterName)) {
          return res.status(400).json({ error: 'Name does not match your index number.' });
        }
      }

      const session = sessionCache.findActiveByPinAndCourse(numericPin, course_code, validatePin);

      if (!session) {
        return res.status(404).json({ error: 'Session not found or expired.' });
      }

      // Use lecture hall geofence
      const refLat = session.lecture_hall_latitude;
      const refLon = session.lecture_hall_longitude;
      const refRadius = session.lecture_hall_radius || 400;

      if (!refLat || !refLon) {
        return res.status(500).json({ error: 'Lecture hall location not configured. Contact your lecturer.' });
      }

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
        `INSERT INTO attendance_records (session_id, index_number, verification_method, device_fingerprint_hash, marked_by)
         VALUES ($1, $2, 'GPS', $3, NULL)
         RETURNING record_id, timestamp`,
        [session.session_id, index_number, fingerprintHash]
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
      if (err.code === '23503') {
        return res.status(404).json({ error: 'Session not found or has expired.' });
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
    body('index_number').isString().trim().isLength({ min: 1, max: 50 }).notEmpty(),
    body('student_name').isString().trim().isLength({ min: 1, max: 255 }).notEmpty(),
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
        'SELECT id FROM student_roster WHERE index_number = $1 AND class_id = $2 AND deleted_at IS NULL',
        [index_number, cachedSession.class_id]
      );
      if (existing.rows.length === 0) {
        await pool.query(
          'INSERT INTO student_roster (index_number, student_name, class_id) VALUES ($1, $2, $3)',
          [index_number, student_name, cachedSession.class_id]
        );
      }

      const result = await pool.query(
        `INSERT INTO attendance_records (session_id, index_number, verification_method, marked_by)
         VALUES ($1, $2, 'MANUAL', $3)
         RETURNING record_id, timestamp`,
        [session_id, index_number, req.user.id]
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
