const request = require('supertest');
const app = require('../src/index');
const { pool } = require('../src/config/db');
require('dotenv').config();

const TEST_COURSE = 'TDBLSUB';
const TEST_CLASS_ID = 1;
const BUILDING_LAT = 5.65;
const BUILDING_LON = -0.186;

let lecturerToken;
let sessionId;
let sessionPin;

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'kasante@university.edu', password: 'lecturer123' });
  lecturerToken = loginRes.body.token;

  // Clean up stale test data from previous runs
  await pool.query("DELETE FROM attendance_records WHERE index_number IN ('TEST001', 'TEST002')");
  await pool.query("DELETE FROM student_roster WHERE index_number IN ('TEST001', 'TEST002')");

  await pool.query(
    'INSERT INTO courses (course_code, course_name, total_weeks) VALUES ($1, $2, $3) ON CONFLICT (course_code) DO UPDATE SET total_weeks = $3',
    [TEST_COURSE, 'Test Double Submit Course', 12]
  );
  await pool.query(
    'INSERT INTO course_lecturers (course_code, lecturer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [TEST_COURSE, loginRes.body.user.id]
  );

  const activateRes = await request(app)
    .post('/api/lecturer/activate')
    .set('Authorization', `Bearer ${lecturerToken}`)
    .send({
      course_code: TEST_COURSE,
      class_ids: [TEST_CLASS_ID],
      week_number: 10,
      building_id: 1,
      duration_minutes: 30,
    });
  sessionId = activateRes.body.sessions[0].session_id;
  sessionPin = activateRes.body.sessions[0].pin;
});

afterAll(async () => {
  if (sessionId) {
    await pool.query('DELETE FROM attendance_records WHERE session_id = $1', [sessionId]);
    await pool.query('DELETE FROM active_sessions WHERE session_id = $1', [sessionId]);
  }
  await pool.query("DELETE FROM attendance_records WHERE index_number IN ('TEST001', 'TEST002')");
  await pool.query("DELETE FROM active_sessions WHERE session_id IN (SELECT session_id FROM active_sessions WHERE course_code = $1 AND session_id != $2)", [TEST_COURSE, sessionId]);
  await pool.query("DELETE FROM student_roster WHERE index_number IN ('TEST001', 'TEST002')");
  await pool.query('DELETE FROM course_lecturers WHERE course_code = $1', [TEST_COURSE]);
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
        latitude: BUILDING_LAT,
        longitude: BUILDING_LON,
        device_fingerprint: 'test-double-fp-1',
      });
    expect(res.status).toBe(201);
    expect(res.body.message).toContain('Marked');
  });

  test('same index_number for same session returns 409', async () => {
    const res = await request(app)
      .post('/api/attendance')
      .send({
        name: 'Test Student',
        index_number: 'TEST001',
        course_code: TEST_COURSE,
        pin: sessionPin,
        latitude: BUILDING_LAT,
        longitude: BUILDING_LON,
        device_fingerprint: 'test-double-fp-2',
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Already marked');
  });

  test('different index_number with same device fingerprint returns 429', async () => {
    const res = await request(app)
      .post('/api/attendance')
      .send({
        name: 'Another Student',
        index_number: 'TEST002',
        course_code: TEST_COURSE,
        pin: sessionPin,
        latitude: BUILDING_LAT,
        longitude: BUILDING_LON,
        device_fingerprint: 'test-double-fp-1',
      });
    expect(res.status).toBe(429);
    expect(res.body.error).toContain('Device used for another student');
  });

  test('same index_number for different session succeeds', async () => {
    const activateRes = await request(app)
      .post('/api/lecturer/activate')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .send({
        course_code: TEST_COURSE,
        class_ids: [TEST_CLASS_ID],
        week_number: 11,
        building_id: 1,
        duration_minutes: 30,
      });
    const newPin = activateRes.body.sessions[0].pin;
    const newSessionId = activateRes.body.sessions[0].session_id;

    const res = await request(app)
      .post('/api/attendance')
      .send({
        name: 'Test Student',
        index_number: 'TEST001',
        course_code: TEST_COURSE,
        pin: newPin,
        latitude: BUILDING_LAT,
        longitude: BUILDING_LON,
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
    expect(res.body.error).toContain('Already marked');
  });
});
