const { Pool } = require('pg');
const os = require('os');
require('dotenv').config();

// In cluster mode, divide max connections across workers
const cpuCount = os.cpus().length;
const maxConnections = parseInt(process.env.DB_POOL_MAX || '20', 10);
const perWorkerMax = Math.max(2, Math.floor(maxConnections / cpuCount));

// Build connection config, handling SSL explicitly to avoid deprecation warnings
const connectionString = process.env.DATABASE_URL || '';
const poolConfig = {
  connectionString,
  max: perWorkerMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

// For Render/production PostgreSQL, configure SSL explicitly
// This avoids the "SSL modes 'prefer', 'require'" deprecation warning
if (connectionString.includes('render.com') || process.env.NODE_ENV === 'production') {
  poolConfig.ssl = { rejectUnauthorized: false };
  // Strip sslmode from connection string to prevent pg from using deprecated aliases
  poolConfig.connectionString = connectionString.replace(/[?&]sslmode=[^&]+/, '').replace(/\?sslmode=[^&]+/, '?');
}

const pool = new Pool(poolConfig);

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
