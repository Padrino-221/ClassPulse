// ═══════════════════════════════════════════════════════════════════
// ClassPulse — PM2 Production Config (Oracle Cloud ARM)
// Place at: /opt/classpulse/backend/ecosystem.config.js
// ═══════════════════════════════════════════════════════════════════
module.exports = {
  apps: [
    {
      name: 'classpulse-api',
      script: 'src/index.js',
      cwd: __dirname,
      // ARM Ampere has 4 OCPUs — use 2 instances (leave room for Nginx + OS)
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      // Logging
      error_file: '/var/log/classpulse/error.log',
      out_file: '/var/log/classpulse/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Auto-restart on crash
      exp_backoff_restart_delay: 100,
    },
  ],
};
