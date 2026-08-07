const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/db');
const { isWithinRange } = require('../services/haversine');
const { hashDeviceFingerprint } = require('../services/fingerprint');
const { namesMatch } = require('../services/nameMatch');
const { validatePin } = require('../services/pin');
const { verifyToken } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const sessionCache = require('../services/sessionCache');

const router = express.Router();

// Name matching (exact after normalization + common-suffix stripping) is shared
// with the admin CSV import via services/nameMatch.js.

// Per-student rate-limit key: IP + course code prefix + index number.
// Students in the same course behind NAT share an IP. Keying on the student's
// own index number gives each individual an independent budget, so an entire
// lecture hall is no longer throttled as a single shared bucket — only one
// person hammering the API is limited at a time.
function studentKeyFromReq(req) {
  const ip = ipKeyGenerator(req);
  const pin = (req.body && req.body.pin) || '';
  const dash = pin.indexOf('-');
  const courseCode = dash > 0 ? pin.substring(0, dash) : 'unknown';
  const indexNumber = (req.body && req.body.index_number) || 'unknown';
  return `${ip}:${courseCode}:${indexNumber}`;
}

const attendanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  // Per-student budget: generous retry allowance without splitting the whole
  // hall into one shared bucket.
  max: process.env.NODE_ENV === 'test' ? 200 : 10,
  message: { error: 'Too many attempts. Please wait a minute and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: studentKeyFromReq,
});

// ---- POST /validate-pin ----
// Validate a session PIN without requiring GPS. Used by the attend page to validate before acquiring location.
const validatePinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 200 : 10,
  message: { error: 'Too many PIN attempts. Wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: studentKeyFromReq,
});

router.post(
  '/validate-pin',
  validatePinLimiter,
  [
    body('pin').isString().trim().isLength({ min: 4, max: 30 }).withMessage('PIN must be 4–30 characters (e.g. CS101-482916).'),
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
        return res.status(404).json({ error: 'Session not found or has ended.' });
      }

      res.json({
        valid: true,
        course_code: session.course_code,
        course_name: session.course_name,
        class_name: session.class_name,
        lecture_hall_name: session.lecture_hall_name,
        week_number: session.week_number,
        geofencing_enabled: session.geofencing_enabled !== false,
      });
    } catch (err) {
      console.error('Validate pin error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

// ---- POST /check-in ----
// Lecture hall geofence + rolling PIN. No auth required for students.
router.post(
  '/check-in',
  attendanceLimiter,
  [
    body('name').isString().trim().isLength({ min: 1, max: 255 }).notEmpty().withMessage('Enter your full name.'),
    body('index_number').isString().trim().isLength({ min: 1, max: 50 }).notEmpty().withMessage('Enter your index number.'),
    body('pin').isString().trim().isLength({ min: 4, max: 30 }).withMessage('PIN must be 4–30 characters (e.g. CS101-482916).'),
    // Latitude/longitude are optional at validation time: sessions with
    // geofencing disabled accept PIN-only check-ins. When geofencing is on,
    // they are enforced below with a friendly error message.
    body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Enter a valid latitude.'),
    body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Enter a valid longitude.'),
    body('accuracy').optional().isFloat({ min: 0 }).withMessage('Accuracy must be a positive number.'),
    body('device_fingerprint').isString().isLength({ min: 1, max: 512 }).notEmpty().withMessage('Device fingerprint is required.'),
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
      // 1. Rolling PIN validation via cache-first lookup
      //    (validated first so roster membership is never disclosed without a valid PIN)
      const session = sessionCache.findActiveByPinAndCourse(numericPin, course_code, validatePin);

      if (!session) {
        return res.status(404).json({ error: 'Session not found or has ended.' });
      }

      // Geofencing defaults ON; only sessions explicitly opted out by the
      // lecturer skip the location check (records are stamped 'PIN' instead).
      const geofencingEnabled = session.geofencing_enabled !== false;

      // 0. Reject poor accuracy readings (only if provided and geofencing is on)
      if (geofencingEnabled && accuracy !== undefined && parseFloat(accuracy) > 100) {
        return res.status(400).json({ error: `GPS accuracy is too low (${Math.round(parseFloat(accuracy))}m). Move outdoors or near a window.` });
      }

      // 2. Roster membership + exact name validation against the session's class
      // 4. Device fingerprint proxy check
      // Run both in parallel since they're independent
      const fingerprintHash = hashDeviceFingerprint(device_fingerprint);
      const [studentCheck, proxyCheck] = await Promise.all([
        pool.query(
          `SELECT student_name FROM student_roster
           WHERE index_number = $1 AND class_id = $2 AND deleted_at IS NULL
           LIMIT 1`,
          [index_number, session.class_id]
        ),
        pool.query(
          `SELECT COUNT(DISTINCT index_number) AS cnt
           FROM attendance_records
           WHERE device_fingerprint_hash = $1
             AND session_id = $2
             AND index_number != $3`,
          [fingerprintHash, session.session_id, index_number]
        ),
      ]);

      if (studentCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Your index number is not registered in this class. Contact your lecturer.' });
      }

      const rosterName = studentCheck.rows[0].student_name;
      if (!namesMatch(name, rosterName)) {
        return res.status(400).json({ error: 'Name does not match your index number.' });
      }

      // 3. Lecture hall geofence check (skipped when the lecturer disabled it)
      let distance = null;
      if (geofencingEnabled) {
        if (!session.lecture_hall_latitude || !session.lecture_hall_longitude || !session.lecture_hall_radius) {
          console.error(`Session ${session.session_id} has no lecture hall geofence configured.`);
          return res.status(500).json({ error: 'Lecture hall location not configured. Contact your lecturer.' });
        }

        if (latitude === undefined || longitude === undefined) {
          return res.status(400).json({ error: 'Location is required for this session. Please enable GPS and try again.' });
        }

        const check = isWithinRange(
          parseFloat(latitude),
          parseFloat(longitude),
          session.lecture_hall_latitude,
          session.lecture_hall_longitude,
          session.lecture_hall_radius
        );
        distance = check.distance;

        if (!check.within) {
          console.log(
            `Geofence reject: student ${index_number} is ${distance}m from lecture hall (limit: ${session.lecture_hall_radius}m)`
          );
          return res.status(403).json({
            error: `You are ${distance}m from the lecture hall. Must be within ${session.lecture_hall_radius}m.`,
          });
        }
      }

      if (parseInt(proxyCheck.rows[0].cnt) > 0) {
        return res.status(429).json({ error: 'Device used for another student.' });
      }

      // 5. Write attendance record. Stamp 'PIN' when the lecturer opted out of
      //    geofencing so reports stay auditable — no coordinates are persisted.
      const verificationMethod = geofencingEnabled ? 'GPS' : 'PIN';
      const insertResult = await pool.query(
        `INSERT INTO attendance_records (session_id, index_number, verification_method, device_fingerprint_hash, marked_by)
         VALUES ($1, $2, $3, $4, NULL)
         RETURNING record_id, timestamp`,
        [session.session_id, index_number, verificationMethod, fingerprintHash]
      );

      sessionCache.invalidateMatricesForCourse(session.course_code, session.class_id);

      res.status(201).json({
        message: 'Attendance recorded successfully.',
        record: insertResult.rows[0],
        session_id: session.session_id,
        lecture_hall: session.lecture_hall_name,
        geofencing_enabled: geofencingEnabled,
        distance,
      });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'This student has already been marked for this session.' });
      }
      if (err.code === '23503') {
        return res.status(404).json({ error: 'Session not found or has ended.' });
      }
      console.error('Check-in error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
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
        return res.status(404).json({ error: 'Session not found or has ended.' });
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
        return res.status(409).json({ error: 'This student has already been marked for this session.' });
      }
      console.error('Manual attendance error:', err);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  }
);

module.exports = router;
