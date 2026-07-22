require('dotenv').config();
const app = require('./src/index');
const http = require('http');

// Wait a bit for cache to prime
setTimeout(() => {
  const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Body:', data);
      process.exit(0);
    });
  });
  req.on('error', (e) => {
    console.error('Error:', e.message);
    process.exit(1);
  });
  req.write(JSON.stringify({ email: 'kasante@university.edu', password: 'lecturer123' }));
  req.end();
}, 3000);
