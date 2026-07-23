module.exports = {
  apps: [
    {
      name: 'classpulse-api',
      script: 'src/index.js',
      cwd: __dirname,
      instances: 'max',
      exec_mode: 'cluster',
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
