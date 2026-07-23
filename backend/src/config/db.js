const { Pool } = require('pg');
const os = require('os');
require('dotenv').config();

// In cluster mode, divide max connections across workers
const cpuCount = os.cpus().length;
const maxConnections = parseInt(process.env.DB_POOL_MAX || '20', 10);
const perWorkerMax = Math.max(2, Math.floor(maxConnections / cpuCount));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: perWorkerMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit immediately — let PM2 handle worker restarts
  if (process.env.NODE_ENV === 'production') {
    console.error('Production mode: continuing after pool error');
  } else {
    process.exit(-1);
  }
});

module.exports = { pool };
