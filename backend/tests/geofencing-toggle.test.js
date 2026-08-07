const request = require('supertest');
const app = require('../src/index');
const { pool } = require('../src/config/db');
require('dotenv').config();

const TEST_COURSE = 'TGEOF';
const TEST_CLASS_ID = 1;
// Coordinates of lecture hall 1 in the test DB (must be inside its 100m geofence)
const BUILDING_LAT = 7.363042;
const BUILDING_LON = -2.351278;
// Well outside the 100m fence around lecture hall 1
const FAR_LAT = 7.42;
const FAR_LON = -2.42;

let lecturerToken;
let lecturerId;
let testCourseId;

async function upsertTestCourse() {
  await pool.query(
    `INSERT INTO courses (course_code, course_name, total_weeks)
     VALUES ($1, $2, $3)
     ON CONFLICT (course_code) WHERE deleted_at IS NULL
     DO UPDATE SET total_weeks = EXCLUDED.total_weeks`,
    [TEST_COURSE, 'Test Geofencing Toggle Course', 12]
  );
  const res = await pool.query(
    'SELECT id FROM courses WHERE course_code = $1 AND deleted_at IS NULL',
    [TEST_COURSE]
  );
  return res.rows[0].id;
}

async function addStudent(indexNumber, name) {
  await pool.query(
    `INSERT INTO student_roster (index_number, student_name, class_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (index_number) WHERE deleted_at IS NULL
     DO NOTHING`,
    [indexNumber, name, TEST_CLASS_ID]
  );
}

async function createSession(week, { geofencing_enabled } = {}) {
  const res = await request(app)
    .post('/api/lecturer/activate')
    .set('Authorization', `Bearer ${lecturerToken}`)
    .send({
      course_code: TEST_COURSE,
      class_ids: [TEST_CLASS_ID],
      week_number: week,
      lecture_hall_id: 1,
      duration_minutes: 30,
      ...(geofencing_enabled === undefined ? {} : { geofencing_enabled }),
    });
  return res.body.sessions[0];
}

async function checkIn({ indexNumber, name, pin, fp, coords }) {
  return request(app)
    .post('/api/attendance/check-in')
    .send({
      name,
      index_number: indexNumber,
      course_code: TEST_COURSE,
      pin: `${TEST_COURSE}-${pin}`,
      device_fingerprint: fp,
      ...(coords || {}),
    });
}

async function methodFor(sessionId, indexNumber) {
  const res = await pool.query(
    'SELECT verification_method FROM attendance_records WHERE session_id = $1 AND index_number = $2',
    [sessionId, indexNumber]
  );
  return res.rows[0] ? res.rows[0].verification_method : null;
}

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'kasante@university.edu', password: 'lecturer123' });
  lecturerToken = loginRes.body.token;
  lecturerId = loginRes.body.user.id;

  // Clean up stale test data
  await pool.query("DELETE FROM attendance_records WHERE index_number IN ('GEOF001', 'GEOF002')");
  await pool.query("DELETE FROM student_roster WHERE index_number IN ('GEOF001', 'GEOF002')");
  await pool.query('DELETE FROM active_sessions WHERE course_code = $1', [TEST_COURSE]);

  testCourseId = await upsertTestCourse();
  await pool.query(
    'INSERT INTO course_lecturers (course_id, lecturer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [testCourseId, lecturerId]
  );
  await addStudent('GEOF001', 'Geofence Student One');
  await addStudent('GEOF002', 'Geofence Student Two');
});

afterAll(async () => {
  await pool.query('DELETE FROM active_sessions WHERE course_code = $1', [TEST_COURSE]);
  await pool.query("DELETE FROM attendance_records WHERE index_number IN ('GEOF001', 'GEOF002')");
  await pool.query("DELETE FROM student_roster WHERE index_number IN ('GEOF001', 'GEOF002')");
  await pool.query('DELETE FROM course_lecturers WHERE course_id = $1', [testCourseId]);
  await pool.query('DELETE FROM courses WHERE course_code = $1', [TEST_COURSE]);
  await pool.end();
});

describe('Geofencing toggle', () => {
  test('default session has geofencing enabled', async () => {
    const session = await createSession(20);
    expect(session.geofencing_enabled).toBe(true);
    await pool.query('DELETE FROM active_sessions WHERE session_id = $1', [session.session_id]);
  });

  test('lecturer can disable geofencing per session', async () => {
    const session = await createSession(21, { geofencing_enabled: false });
    expect(session.geofencing_enabled).toBe(false);
    await pool.query('DELETE FROM active_sessions WHERE session_id = $1', [session.session_id]);
  });

  test('validate-pin reports the flag the attend page relies on', async () => {
    const session = await createSession(26, { geofencing_enabled: false });
    const res = await request(app)
      .post('/api/attendance/validate-pin')
      .send({ pin: `${TEST_COURSE}-${session.pin}`, index_number: 'GEOF001' });
    expect(res.status).toBe(200);
    expect(res.body.geofencing_enabled).toBe(false);
    await pool.query('DELETE FROM active_sessions WHERE session_id = $1', [session.session_id]);
  });

  test('disabled session: check-in without coordinates succeeds and is stamped PIN', async () => {
    const session = await createSession(22, { geofencing_enabled: false });
    const res = await checkIn({
      indexNumber: 'GEOF001',
      name: 'Geofence Student One',
      pin: session.pin,
      fp: 'geof-toggled-fp-1',
    });
    expect(res.status).toBe(201);
    expect(res.body.geofencing_enabled).toBe(false);
    expect(await methodFor(session.session_id, 'GEOF001')).toBe('PIN');

    await pool.query('DELETE FROM attendance_records WHERE session_id = $1', [session.session_id]);
    await pool.query('DELETE FROM active_sessions WHERE session_id = $1', [session.session_id]);
  });

  test('disabled session: check-in from far outside the fence still succeeds', async () => {
    const session = await createSession(23, { geofencing_enabled: false });
    const res = await checkIn({
      indexNumber: 'GEOF002',
      name: 'Geofence Student Two',
      pin: session.pin,
      fp: 'geof-toggled-fp-2',
      coords: { latitude: FAR_LAT, longitude: FAR_LON, accuracy: 5 },
    });
    expect(res.status).toBe(201);

    await pool.query('DELETE FROM attendance_records WHERE session_id = $1', [session.session_id]);
    await pool.query('DELETE FROM active_sessions WHERE session_id = $1', [session.session_id]);
  });

  test('enabled session: check-in from far outside the fence is rejected', async () => {
    const session = await createSession(24); // defaults to enabled
    const res = await checkIn({
      indexNumber: 'GEOF001',
      name: 'Geofence Student One',
      pin: session.pin,
      fp: 'geof-enabled-fp-1',
      coords: { latitude: FAR_LAT, longitude: FAR_LON, accuracy: 5 },
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Must be within');

    await pool.query('DELETE FROM active_sessions WHERE session_id = $1', [session.session_id]);
  });

  test('enabled session: check-in without coordinates returns a friendly error', async () => {
    const session = await createSession(25); // defaults to enabled
    const res = await checkIn({
      indexNumber: 'GEOF001',
      name: 'Geofence Student One',
      pin: session.pin,
      fp: 'geof-enabled-fp-2',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Location is required');

    await pool.query('DELETE FROM active_sessions WHERE session_id = $1', [session.session_id]);
  });
});
