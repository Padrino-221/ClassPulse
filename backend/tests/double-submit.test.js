const request = require('supertest');
const app = require('../src/index');
const { pool } = require('../src/config/db');
require('dotenv').config();

const TEST_COURSE = 'TDBLSUB';
const TEST_CLASS_ID = 1;

let lecturerToken;
let sessionId;
let sessionPin;

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'kasante@university.edu', password: 'lecturer123' });
  lecturerToken = loginRes.body.token;

  await pool.query(
    'INSERT INTO courses (course_code, course_name, total_weeks) VALUES ($1, $2, $3) ON CONFLICT (course_code) DO UPDATE SET total_weeks = $3',
    [TEST_COURSE, 'Test Double Submit Course', 12]
  );

  const activateRes = await request(app)
    .post('/api/lecturer/activate')
    .set('Authorization', `Bearer ${lecturerToken}`)
    .send({
      course_code: TEST_COURSE,
      class_id: TEST_CLASS_ID,
      week_number: 10,
      latitude: 5.6037,
      longitude: -0.1870,
      duration_minutes: 30,
    });
  sessionId = activateRes.body.session.session_id;
  sessionPin = activateRes.body.session.pin;
});

afterAll(async () => {
  if (sessionId) {
    await pool.query('DELETE FROM attendance_records WHERE session_id = $1', [sessionId]);
    await pool.query('DELETE FROM active_sessions WHERE session_id = $1', [sessionId]);
  }
  await pool.query('DELETE FROM courses WHERE course_code = $1', [TEST_COURSE]);
  await pool.end();
});

describe('Double Submission Prevention', () => {
  test('first submission succeeds', async () => {
    const res = await request(app)
      .post('/api/attendance')
      .send({
        name: 'Test Student',
        index_number: 'TEST001',
        course_code: TEST_COURSE,
        pin: sessionPin,
        latitude: 5.6037,
        longitude: -0.1870,
        device_fingerprint: 'test-double-fp-1',
      });
    expect(res.status).toBe(201);
    expect(res.body.message).toContain('successfully');
  });

  test('same index_number for same session returns 409', async () => {
    const res = await request(app)
      .post('/api/attendance')
      .send({
        name: 'Test Student',
        index_number: 'TEST001',
        course_code: TEST_COURSE,
        pin: sessionPin,
        latitude: 5.6037,
        longitude: -0.1870,
        device_fingerprint: 'test-double-fp-2',
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already been marked');
  });

  test('different index_number with same device fingerprint returns 429', async () => {
    const res = await request(app)
      .post('/api/attendance')
      .send({
        name: 'Another Student',
        index_number: 'TEST002',
        course_code: TEST_COURSE,
        pin: sessionPin,
        latitude: 5.6037,
        longitude: -0.1870,
        device_fingerprint: 'test-double-fp-1',
      });
    expect(res.status).toBe(429);
    expect(res.body.error).toContain('Potential Proxy Submission');
  });

  test('same index_number for different session succeeds', async () => {
    const activateRes = await request(app)
      .post('/api/lecturer/activate')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .send({
        course_code: TEST_COURSE,
        class_id: TEST_CLASS_ID,
        week_number: 11,
        latitude: 5.6037,
        longitude: -0.1870,
        duration_minutes: 30,
      });
    const newPin = activateRes.body.session.pin;
    const newSessionId = activateRes.body.session.session_id;

    const res = await request(app)
      .post('/api/attendance')
      .send({
        name: 'Test Student',
        index_number: 'TEST001',
        course_code: TEST_COURSE,
        pin: newPin,
        latitude: 5.6037,
        longitude: -0.1870,
        device_fingerprint: 'test-double-fp-3',
      });
    expect(res.status).toBe(201);

    await pool.query('DELETE FROM attendance_records WHERE session_id = $1', [newSessionId]);
    await pool.query('DELETE FROM active_sessions WHERE session_id = $1', [newSessionId]);
  });

  test('manual override duplicates also returns 409', async () => {
    const res = await request(app)
      .post('/api/attendance/manual')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .send({
        session_id: sessionId,
        index_number: 'TEST001',
        student_name: 'Test Student Again',
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already been marked');
  });
});
