require('dotenv').config();
const express = require('express');
const request = require('supertest');

// Direct test of the auth route
const authRoutes = require('./src/routes/auth');
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

async function main() {
  try {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'kasante@university.edu', password: 'lecturer123' });
    console.log('Status:', res.status);
    console.log('Body:', JSON.stringify(res.body));
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}

main();
