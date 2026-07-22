const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { pool } = require('./config/db');
const sessionCache = require('./services/sessionCache');

const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const lecturerRoutes = require('./routes/lecturer');
const adminRoutes = require('./routes/admin');
const campusRoutes = require('./routes/campus');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/lecturer', lecturerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/campuses', campusRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize in-memory session cache on startup
sessionCache.reloadFromDb(pool).then(() => {
  console.log('Session cache primed with active sessions.');

  // Periodic cache refresh every 30 seconds
  setInterval(() => {
    sessionCache.reloadFromDb(pool).catch((err) => {
      console.error('Session cache refresh error:', err);
    });
  }, 30000);
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ClassPulse API running on port ${PORT} on all interfaces`);
  });
}

module.exports = app;
