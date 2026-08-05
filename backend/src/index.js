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

// Trust the first proxy hop (Render load balancer / nginx reverse proxy) so
// req.ip — and therefore per-IP rate limiting and audit logs — sees the real
// client IP from X-Forwarded-For instead of the proxy's address.
// Gated on NODE_ENV=production (all deployments set it) so that in local dev,
// where the API is hit directly with no proxy, clients cannot spoof
// X-Forwarded-For to reset their rate-limit bucket.
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

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

// ── Email icon assets (public, no auth) ──
const EMAIL_ICONS = {
  shield: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="white" viewBox="0 0 256 256"><path d="M208,40H48A16,16,0,0,0,32,56V128c0,49.07,33.54,94.61,78.71,106.55a15.84,15.84,0,0,0,12.58,0C168.46,222.61,202,177.07,202,128V56A16,16,0,0,0,188,40Zm-61,82.75-40,40a8,8,0,0,1-11.32-11.32L116.69,128,88.4,99.6a8,8,0,0,1,11.32-11.32l40,40A8,8,0,0,1,147,122.75Z"/></svg>`,
  wave: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="white" viewBox="0 0 256 256"><path d="M156,128a8,8,0,0,0-8,8v23.55l-19.64-19.64a8,8,0,0,0-11.32,11.32L140.69,176H96a8,8,0,0,0,0,16h40a8,8,0,0,0,8-8V136A8,8,0,0,0,156,128ZM219.71,188.63l-72.54-41.73A4.73,4.73,0,0,0,144,151v17.37l-38.18-22a4,4,0,0,0-4.24.22L72,160.42V112a4,4,0,0,0-4-4,4,4,0,0,0-4,4V200a4,4,0,0,0,4,4h40a4,4,0,0,0,4-4V181.55l38.72,22.35a31.54,31.54,0,0,0,15.14,4.1c.14,0,.27,0,.41,0a32,32,0,0,0,30-21.34l5.57-43.95A4,4,0,0,0,198.11,130a4,4,0,0,0-2.87,1.64l-10.73,16.09V112a4,4,0,0,0-8,0v26.29l-6.13-9.2a4,4,0,0,0-6.62-.24l-22.36,33.54V128a4,4,0,0,0-8,0v39.29l-13.27-19.91a4,4,0,0,0-6.62-.24L92,172.91V128a4,4,0,0,0-8,0V200a4,4,0,0,0,4,4h40a4,4,0,0,0,4-4V181.55"/></svg>`,
  clock: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#6B7280" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm8-128V128l24,24"/></svg>`,
  lock: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#6B7280" viewBox="0 0 256 256"><path d="M208,104H181.31L164.69,87.38A52,52,0,0,0,72,80V56a8,8,0,0,0-8,8V200a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V112A8,8,0,0,0,208,104ZM128,168a16,16,0,1,1,16-16A16,16,0,0,1,128,168Z"/></svg>`,
};
app.get('/api/assets/icons/:name.svg', (req, res) => {
  const svg = EMAIL_ICONS[req.params.name];
  if (!svg) return res.status(404).end();
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=604800');
  res.send(svg);
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
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
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
    if (require.main === module) {
      cacheInterval = setInterval(() => {
        sessionCache.reloadSessionsOnly(pool).catch((err) => {
          console.error('Session cache refresh error:', err);
        });
      }, 30000);
    }
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
        const result = await pool.query(
          `UPDATE active_sessions
           SET is_active = TRUE
           WHERE is_active = FALSE
             AND scheduled_at IS NOT NULL
             AND scheduled_at <= NOW()
             AND (expires_at IS NULL OR expires_at > NOW())
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
