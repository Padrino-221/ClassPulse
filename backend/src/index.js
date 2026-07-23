const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { pool } = require('./config/db');
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
const buildingRoutes = require('./routes/building');
const reportRoutes = require('./routes/report');

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
app.use('/api/buildings', buildingRoutes);
app.use('/api/reports', reportRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Session cache + interval cleanup ──
let cacheInterval = null;

sessionCache.reloadFromDb(pool).then(() => {
  console.log('Session cache primed with active sessions.');
  cacheInterval = setInterval(() => {
    sessionCache.reloadFromDb(pool).catch((err) => {
      console.error('Session cache refresh error:', err);
    });
  }, 30000);
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
  });
  app._server = server;
}

module.exports = app;
