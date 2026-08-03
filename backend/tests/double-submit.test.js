const request = require('supertest');
const app = require('../src/index');
const { pool } = require('../src/config/db');
require('dotenv').config();

const TEST_COURSE = 'TDBLSUB';
const TEST_CLASS_ID = 1;
// Coordinates of lecture hall 1 in the test DB (must be inside its 100m geofence)
const BUILDING_LAT = 7.363042;
const BUILDING_LON = -2.351278;

let lecturerToken;
let lecturerId;
let testCourseId;
let sessionId;
let sessionPin;

async function upsertTestCourse() {
  await pool.query(
    `INSERT INTO courses (course_code, course_name, total_weeks)
     VALUES ($1, $2, $3)
     ON CONFLICT (course_code) WHERE deleted_at IS NULL
     DO UPDATE SET total_weeks = EXCLUDED.total_weeks`,
    [TEST_COURSE, 'Test Double Submit Course', 12]
  );
  const res = await pool.query(
    'SELECT id FROM courses WHERE course_code = $1 AND deleted_at IS NULL',
    [TEST_COURSE]
  );
  return res.rows[0].id;
}

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'kasante@university.edu', password: 'lecturer123' });
  lecturerToken = loginRes.body.token;
  lecturerId = loginRes.body.user.id;

  // Clean up stale test data from previous runs
  await pool.query("DELETE FROM attendance_records WHERE index_number IN ('TEST001', 'TEST002', 'TEST003')");
  await pool.query("DELETE FROM student_roster WHERE index_number IN ('TEST001', 'TEST002', 'TEST003')");

  testCourseId = await upsertTestCourse();
  await pool.query(
    'INSERT INTO course_lecturers (course_id, lecturer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [testCourseId, lecturerId]
  );

  // Test students must be in the class roster for the attendance check-in to accept them
  await pool.query(
    `INSERT INTO student_roster (index_number, student_name, class_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (index_number) WHERE deleted_at IS NULL
     DO NOTHING`,
    ['TEST001', 'Test Student', TEST_CLASS_ID]
  );
  await pool.query(
    `INSERT INTO student_roster (index_number, student_name, class_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (index_number) WHERE deleted_at IS NULL
     DO NOTHING`,
    ['TEST002', 'Another Student', TEST_CLASS_ID]
  );
  // Roster name carries the common "(ms)" suffix seen in real imports
  await pool.query(
    `INSERT INTO student_roster (index_number, student_name, class_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (index_number) WHERE deleted_at IS NULL
     DO NOTHING`,
    ['TEST003', 'Test Student Three (ms)', TEST_CLASS_ID]
  );

  const activateRes = await request(app)
    .post('/api/lecturer/activate')
    .set('Authorization', `Bearer ${lecturerToken}`)
    .send({
      course_code: TEST_COURSE,
      class_ids: [TEST_CLASS_ID],
      week_number: 10,
      lecture_hall_id: 1,
      duration_minutes: 30,
    });
  sessionId = activateRes.body.sessions[0].session_id;
  sessionPin = activateRes.body.sessions[0].pin;
});

afterAll(async () => {
  if (sessionId) {
    await pool.query('DELETE FROM attendance_records WHERE session_id = $1', [sessionId]);
    await pool.query('DELETE FROM active_sessions WHERE session_id = $1', [sessionId]);
    await pool.query('DELETE FROM active_sessions WHERE course_code = $1 AND session_id != $2', [TEST_COURSE, sessionId]);
  }
  await pool.query("DELETE FROM attendance_records WHERE index_number IN ('TEST001', 'TEST002', 'TEST003')");
  await pool.query("DELETE FROM student_roster WHERE index_number IN ('TEST001', 'TEST002', 'TEST003')");
  await pool.query('DELETE FROM course_lecturers WHERE course_id = $1', [testCourseId]);
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
        pin: `${TEST_COURSE}-${sessionPin}`,
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
        pin: `${TEST_COURSE}-${sessionPin}`,
        latitude: BUILDING_LAT,
        longitude: BUILDING_LON,
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
        pin: `${TEST_COURSE}-${sessionPin}`,
        latitude: BUILDING_LAT,
        longitude: BUILDING_LON,
        device_fingerprint: 'test-double-fp-1',
      });
    expect(res.status).toBe(429);
    expect(res.body.error).toContain('Device used for another student');
  });

  test('index number not in the class roster returns 403', async () => {
    const res = await request(app)
      .post('/api/attendance')
      .send({
        name: 'Ghost Student',
        index_number: 'GHOST001',
        course_code: TEST_COURSE,
        pin: `${TEST_COURSE}-${sessionPin}`,
        latitude: BUILDING_LAT,
        longitude: BUILDING_LON,
        device_fingerprint: 'test-double-fp-ghost',
      });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('not registered');
  });

  test('name that is not an exact roster match returns 400', async () => {
    const res = await request(app)
      .post('/api/attendance')
      .send({
        name: 'Student Test', // swapped word order — no longer accepted
        index_number: 'TEST001',
        course_code: TEST_COURSE,
        pin: `${TEST_COURSE}-${sessionPin}`,
        latitude: BUILDING_LAT,
        longitude: BUILDING_LON,
        device_fingerprint: 'test-double-fp-name',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Name does not match');
  });

  test('roster name suffix like (ms) is ignored when matching', async () => {
    // Roster entry is 'Test Student Three (ms)'; checking in without the suffix is accepted
    const res = await request(app)
      .post('/api/attendance')
      .send({
        name: 'Test Student Three',
        index_number: 'TEST003',
        course_code: TEST_COURSE,
        pin: `${TEST_COURSE}-${sessionPin}`,
        latitude: BUILDING_LAT,
        longitude: BUILDING_LON,
        device_fingerprint: 'test-double-fp-suffix',
      });
    expect(res.status).toBe(201);
  });

  test('same index_number for different session succeeds', async () => {
    const activateRes = await request(app)
      .post('/api/lecturer/activate')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .send({
        course_code: TEST_COURSE,
        class_ids: [TEST_CLASS_ID],
        week_number: 11,
        lecture_hall_id: 1,
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
        pin: `${TEST_COURSE}-${newPin}`,
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
    expect(res.body.error).toContain('already been marked');
  });
});
