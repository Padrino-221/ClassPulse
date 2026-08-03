const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cron = require('node-cron');
require('dotenv').config();

const { pool } = require('./config/db');
const { runMigrations } = require('./db/migrate');
const { getCurrentPin, staticPinFromSeed } = require('./services/pin');
const sessionCache = require('./services/sessionCache');

// ── Startup validation ──
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable must be set.');
  process.exit(1);
}

// Global unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const lecturerRoutes = require('./routes/lecturer');
const adminRoutes = require('./routes/admin');
const lectureHallRoutes = require('./routes/lectureHall');
const reportRoutes = require('./routes/report');
const universityRoutes = require('./routes/university');
const schoolRoutes = require('./routes/school');
const departmentRoutes = require('./routes/department');
const invitationRoutes = require('./routes/invitation');
const searchRoutes = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security headers ──
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ──
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// ── Coerce body numbers to strings for express-validator ──
// validator.js requires string input but express.json() sends native JS types.
function coerceBodyNumbers(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'number') {
        req.body[key] = String(req.body[key]);
      }
      if (Array.isArray(req.body[key])) {
        req.body[key] = req.body[key].map(v => typeof v === 'number' ? String(v) : v);
      }
    }
  }
  next();
}
app.use(coerceBodyNumbers);

// ── Health check (no DB) ──
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok' });
});

// ── Health check (verifies DB connectivity) ──
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Health check DB error:', err.message);
    res.status(503).json({ status: 'error', error: 'Database unreachable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/lecturer', lecturerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/lecture-halls', lectureHallRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/universities', universityRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/admins', invitationRoutes);
app.use('/api/search', searchRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Run migrations then load session cache ──
let cacheInterval = null;

runMigrations(pool)
  .catch((err) => {
    console.error('Migration warning:', err.message);
  })
  .then(() => sessionCache.reloadFromDb(pool))
  .then(() => {
    console.log('Session cache primed with active sessions.');
    cacheInterval = setInterval(() => {
      sessionCache.reloadFromDb(pool).catch((err) => {
        console.error('Session cache refresh error:', err);
      });
    }, 30000);
  })
  .catch((err) => {
    console.error('Startup error:', err.message);
  });

// ── Graceful shutdown ──
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  if (cacheInterval) clearInterval(cacheInterval);
  const server = app._server || null;
  if (server) {
    server.close(() => {
      pool.end().then(() => {
        console.log('Database pool closed.');
        process.exit(0);
      });
    });
  } else {
    pool.end().then(() => process.exit(0));
  }
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`ClassPulse API running on port ${PORT} on all interfaces`);

    // Self-ping every 14 minutes to prevent Render free tier from sleeping
    if (process.env.NODE_ENV === 'production') {
      cron.schedule('*/14 * * * *', async () => {
        try {
          const http = require('http');
          const url = `http://localhost:${PORT}/api/ping`;
          http.get(url, (res) => {
            console.log(`[Keep-alive] Self-ping: ${res.statusCode}`);
          }).on('error', (err) => {
            console.error(`[Keep-alive] Self-ping failed: ${err.message}`);
          });
        } catch (err) {
          console.error(`[Keep-alive] Error: ${err.message}`);
        }
      });
      console.log('Keep-alive cron scheduled (every 14 minutes)');
    }

    // Auto-activate scheduled sessions every minute
    cron.schedule('* * * * *', async () => {
      try {
        const { pool } = require('./config/db');
        const sessionCache = require('./services/sessionCache');

        const result = await pool.query(
          `UPDATE active_sessions
           SET is_active = TRUE
           WHERE is_active = FALSE
             AND scheduled_at IS NOT NULL
             AND scheduled_at <= NOW()
           RETURNING session_id, course_id, course_code, class_id, week_number, pin_seed,
                     pin_spinning, lecture_hall_id, expires_at`
        );

        // Fetch class names and course names for activated sessions
        const classIds = result.rows.map((r) => r.class_id);
        const courseIds = result.rows.map((r) => r.course_id);
        const classMap = {};
        const courseMap = {};
        if (classIds.length > 0) {
          const classRes = await pool.query(
            `SELECT class_id, class_name FROM classes WHERE class_id = ANY($1)`,
            [classIds]
          );
          for (const row of classRes.rows) {
            classMap[row.class_id] = row.class_name;
          }
          const courseRes = await pool.query(
            `SELECT id, course_code, course_name FROM courses WHERE id = ANY($1)`,
            [courseIds]
          );
          for (const row of courseRes.rows) {
            courseMap[row.id] = row;
          }
        }

        if (result.rows.length > 0) {
          console.log(`[Cron] Auto-activated ${result.rows.length} scheduled session(s)`);
          for (const row of result.rows) {
            const staticPin = row.pin_spinning !== false ? null : staticPinFromSeed(row.pin_seed);
            sessionCache.set({
              session_id: row.session_id,
              pin_seed: row.pin_seed,
              static_pin: staticPin,
              pin_spinning: row.pin_spinning,
              course_code: row.course_code,
              course_name: (courseMap[row.course_id] && courseMap[row.course_id].course_name) || null,
              class_id: row.class_id,
              class_name: classMap[row.class_id] || null,
              week_number: row.week_number,
              is_active: true,
              lecture_hall_id: row.lecture_hall_id,
              expires_at: row.expires_at,
            });
          }
        }
      } catch (err) {
        console.error('[Cron] Session auto-activation error:', err.message);
      }
    });
    console.log('Session auto-activation cron scheduled (every minute)');

    // Auto-deactivate expired sessions every minute
    cron.schedule('* * * * *', async () => {
      try {
        const { pool } = require('./config/db');
        const sessionCache = require('./services/sessionCache');

        const result = await pool.query(
          `UPDATE active_sessions
           SET is_active = FALSE
           WHERE is_active = TRUE
             AND expires_at IS NOT NULL
             AND expires_at <= NOW()
           RETURNING session_id`
        );

        if (result.rows.length > 0) {
          console.log(`[Cron] Auto-deactivated ${result.rows.length} expired session(s)`);
          for (const row of result.rows) {
            sessionCache.deactivate(row.session_id);
          }
        }
      } catch (err) {
        console.error('[Cron] Session auto-deactivation error:', err.message);
      }
    });
    console.log('Session auto-deactivation cron scheduled (every minute)');
  });
  app._server = server;
}

module.exports = app;
