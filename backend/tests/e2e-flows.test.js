const request = require('supertest');
const { pool } = require('../src/config/db');
const app = require('../src/index');
require('dotenv').config();

jest.setTimeout(30000);

const COURSE = 'TEFLOW';
const CLASS_ID = 1;
const HALL_LAT = 7.363042;   // lecture hall 1 coordinates (100m fence)
const HALL_LON = -2.351278;
const FAR_LAT = 7.45;        // well outside the fence
const FAR_LON = -2.45;

let adminToken;
let lecturerToken;
let lecturerId;
let courseId;
let hallId;
let createdYearId;
let createdSemesterId;
let mainSession;      // geofencing ON
let noGeoSession;     // geofencing OFF
let throwawaySession; // used for the deactivate test
let scheduledId;

const baseCheckIn = (overrides) =>
  request(app)
    .post('/api/attendance/check-in')
    .send({
      name: 'Eflow Student One',
      index_number: 'EFLOW001',
      course_code: COURSE,
      pin: `${COURSE}-${mainSession.pin}`,
      latitude: HALL_LAT,
      longitude: HALL_LON,
      accuracy: 5,
      device_fingerprint: 'eflow-fp-base',
      ...overrides,
    });

async function dbStamp(sessionId, indexNumber) {
  const res = await pool.query(
    'SELECT verification_method FROM attendance_records WHERE session_id = $1 AND index_number = $2',
    [sessionId, indexNumber]
  );
  return res.rows[0] ? res.rows[0].verification_method : null;
}

beforeAll(async () => {
  // ── Admin + lecturer logins ──
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@classpulse.com', password: 'admin123' });
  expect(adminLogin.status).toBe(200);
  adminToken = adminLogin.body.token;

  const lecturerLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'kasante@university.edu', password: 'lecturer123' });
  expect(lecturerLogin.status).toBe(200);
  lecturerToken = lecturerLogin.body.token;
  lecturerId = lecturerLogin.body.user.id;

  // Capture the current active semester — the suite never flips it.
  const sem = await pool.query('SELECT id FROM semesters WHERE is_active = true LIMIT 1');
  expect(sem.rows.length).toBeGreaterThan(0);

  // ── Test course + roster (direct DB setup, as the other suites do) ──
  await pool.query('DELETE FROM active_sessions WHERE course_code = $1', [COURSE]);
  await pool.query("DELETE FROM student_roster WHERE index_number IN ('EFLOW001', 'EFLOW002', 'EFLOW003')");
  await pool.query(
    `INSERT INTO courses (course_code, course_name, total_weeks)
     VALUES ($1, $2, $3)
     ON CONFLICT (course_code) WHERE deleted_at IS NULL
     DO UPDATE SET total_weeks = EXCLUDED.total_weeks`,
    [COURSE, 'E2E Flow Course', 12]
  );
  const c = await pool.query('SELECT id FROM courses WHERE course_code = $1 AND deleted_at IS NULL', [COURSE]);
  courseId = c.rows[0].id;
  await pool.query(
    'INSERT INTO course_lecturers (course_id, lecturer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [courseId, lecturerId]
  );
  // Ensure the lecturer→class assignment exists (other suites' cleanup can
  // remove the seeded row; the lecturer legitimately owns class 1).
  await pool.query(
    'INSERT INTO class_lecturers (class_id, lecturer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [CLASS_ID, lecturerId]
  );
  await pool.query(
    `INSERT INTO student_roster (index_number, student_name, class_id)
     VALUES ($1, $2, $3) ON CONFLICT (index_number) WHERE deleted_at IS NULL DO NOTHING`,
    ['EFLOW001', 'Eflow Student One', CLASS_ID]
  );
  await pool.query(
    `INSERT INTO student_roster (index_number, student_name, class_id)
     VALUES ($1, $2, $3) ON CONFLICT (index_number) WHERE deleted_at IS NULL DO NOTHING`,
    ['EFLOW002', 'Eflow Student Two', CLASS_ID]
  );

  // ── Sessions (via the lecturer API) ──
  const activate = async (week, extra = {}) => {
    const res = await request(app)
      .post('/api/lecturer/activate')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .send({ course_code: COURSE, class_ids: [CLASS_ID], week_number: week, lecture_hall_id: 1, duration_minutes: 60, ...extra });
    return res;
  };

  const main = await activate(90);
  expect(main.status).toBe(201);
  mainSession = main.body.sessions[0];

  const noGeo = await activate(91, { geofencing_enabled: false });
  expect(noGeo.status).toBe(201);
  noGeoSession = noGeo.body.sessions[0];

  const throwaway = await activate(93);
  expect(throwaway.status).toBe(201);
  throwawaySession = throwaway.body.sessions[0];
});

afterAll(async () => {
  try {
    if (scheduledId) await pool.query('DELETE FROM active_sessions WHERE session_id = $1', [scheduledId]);
    await pool.query('DELETE FROM active_sessions WHERE course_code = $1', [COURSE]);
    await pool.query('DELETE FROM attendance_records WHERE index_number IN ($1, $2, $3)', ['EFLOW001', 'EFLOW002', 'EFLOW003']);
    await pool.query("DELETE FROM student_roster WHERE index_number IN ('EFLOW001', 'EFLOW002', 'EFLOW003')");
    if (courseId) {
      await pool.query('DELETE FROM course_lecturers WHERE course_id = $1', [courseId]);
      await pool.query('DELETE FROM courses WHERE course_code = $1', [COURSE]);
    }
    if (hallId) await pool.query('DELETE FROM lecture_halls WHERE id = $1', [hallId]);
    if (createdSemesterId) await pool.query('DELETE FROM semesters WHERE id = $1', [createdSemesterId]);
    if (createdYearId) await pool.query('DELETE FROM academic_years WHERE id = $1', [createdYearId]);
  } finally {
    await pool.end();
  }
});

describe('Admin flow', () => {
  test('admin can read profile', async () => {
    const res = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });

  test('wrong password is rejected with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@classpulse.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  test('unknown email is rejected with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.edu', password: 'whatever123' });
    expect(res.status).toBe(401);
  });

  test('invalid login body is rejected with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email', password: 'x' });
    expect(res.status).toBe(400);
  });

  test('admin can create a lecture hall', async () => {
    const res = await request(app)
      .post('/api/lecture-halls')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Test Hall', latitude: 5.65, longitude: -0.19, radius: 150 });
    expect(res.status).toBe(201);
    hallId = res.body.lecture_hall.id;
    expect(res.body.lecture_hall.radius).toBe(150);
  });

  test('lecture hall with invalid latitude is rejected with 400', async () => {
    const res = await request(app)
      .post('/api/lecture-halls')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad Hall', latitude: 95, longitude: 0, radius: 150 });
    expect(res.status).toBe(400);
  });

  test('lecture hall with out-of-range radius is rejected with 400', async () => {
    const res = await request(app)
      .post('/api/lecture-halls')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Tiny Hall', latitude: 5.65, longitude: -0.19, radius: 1 });
    expect(res.status).toBe(400);
  });

  test('admin can update a lecture hall', async () => {
    const res = await request(app)
      .put(`/api/lecture-halls/${hallId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ radius: 250 });
    expect(res.status).toBe(200);
    expect(res.body.lecture_hall.radius).toBe(250);
  });

  test('university admin is denied from creating courses (scope edge case)', async () => {
    const res = await request(app)
      .post('/api/admin/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ course_code: 'XDENY', course_name: 'Denied', total_weeks: 12, lecturer_ids: [lecturerId] });
    expect(res.status).toBe(403);
  });

  test('admin can create and delete an academic year + semester', async () => {
    const yearRes = await request(app)
      .post('/api/admin/academic-years')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ label: 'E2E Test Year', start_year: 2029, end_year: 2030 });
    expect(yearRes.status).toBe(201);
    createdYearId = yearRes.body.academic_year.id;

    const semRes = await request(app)
      .post('/api/admin/semesters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        academic_year_id: createdYearId,
        number: 1,
        start_date: '2029-01-10T00:00:00.000Z',
        end_date: '2029-06-30T00:00:00.000Z',
      });
    expect(semRes.status).toBe(201);
    createdSemesterId = semRes.body.semester.id;

    // Duplicate semester for the same year is a 409
    const dup = await request(app)
      .post('/api/admin/semesters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        academic_year_id: createdYearId,
        number: 1,
        start_date: '2029-01-10T00:00:00.000Z',
        end_date: '2029-06-30T00:00:00.000Z',
      });
    expect(dup.status).toBe(409);
  });

  test('activating a non-existent semester is a 404', async () => {
    const res = await request(app)
      .post('/api/admin/semesters/999999/activate')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  test('admin can read the active semester', async () => {
    const res = await request(app).get('/api/admin/active-semester').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('admin can delete the test lecture hall (soft delete)', async () => {
    const res = await request(app)
      .delete(`/api/lecture-halls/${hallId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const listed = await request(app).get('/api/lecture-halls').set('Authorization', `Bearer ${adminToken}`);
    const ids = listed.body.lecture_halls.map((h) => h.id);
    expect(ids).not.toContain(hallId);
  });
});

describe('Lecturer flow', () => {
  test('lecturer can read profile', async () => {
    const res = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${lecturerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('lecturer');
  });

  test('activate without a lecture hall is rejected with 400', async () => {
    const res = await request(app)
      .post('/api/lecturer/activate')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .send({ course_code: COURSE, class_ids: [CLASS_ID], week_number: 99, duration_minutes: 60 });
    expect(res.status).toBe(400);
  });

  test('activate without classes is rejected with 400', async () => {
    const res = await request(app)
      .post('/api/lecturer/activate')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .send({ course_code: COURSE, class_ids: [], week_number: 99, lecture_hall_id: 1, duration_minutes: 60 });
    expect(res.status).toBe(400);
  });

  test('duplicate week for the same course+class is a 409', async () => {
    const res = await request(app)
      .post('/api/lecturer/activate')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .send({ course_code: COURSE, class_ids: [CLASS_ID], week_number: 90, lecture_hall_id: 1, duration_minutes: 60 });
    expect(res.status).toBe(409);
  });

  test('session list reports the geofencing flag', async () => {
    const res = await request(app).get('/api/lecturer/sessions').set('Authorization', `Bearer ${lecturerToken}`);
    expect(res.status).toBe(200);
    const main = res.body.sessions.find((s) => s.session_id === mainSession.session_id);
    const noGeo = res.body.sessions.find((s) => s.session_id === noGeoSession.session_id);
    expect(main.geofencing_enabled).toBe(true);
    expect(noGeo.geofencing_enabled).toBe(false);
  });

  test('pin endpoint returns the live PIN', async () => {
    const res = await request(app)
      .get(`/api/lecturer/session/${mainSession.session_id}/pin`)
      .set('Authorization', `Bearer ${lecturerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(true);
    expect(res.body.pin).toContain(`${COURSE}-`);
  });

  test('lecturer can schedule, list, then cancel a session', async () => {
    const future = new Date(Date.now() + 2 * 3600e3).toISOString();
    const sched = await request(app)
      .post('/api/lecturer/schedule')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .send({ course_code: COURSE, class_ids: [CLASS_ID], scheduled_date: future, duration_minutes: 60, week_number: 30, lecture_hall_id: 1 });
    expect(sched.status).toBe(201);
    scheduledId = sched.body.sessions[0].session_id;

    const list = await request(app).get('/api/lecturer/scheduled').set('Authorization', `Bearer ${lecturerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.map((s) => s.session_id)).toContain(scheduledId);

    const cancel = await request(app)
      .delete(`/api/lecturer/scheduled/${scheduledId}`)
      .set('Authorization', `Bearer ${lecturerToken}`);
    expect(cancel.status).toBe(200);

    const after = await request(app).get('/api/lecturer/scheduled').set('Authorization', `Bearer ${lecturerToken}`);
    expect(after.body.map((s) => s.session_id)).not.toContain(scheduledId);
    scheduledId = null; // row already removed by the API
  });

  test('lecturer can fetch history matrix', async () => {
    const res = await request(app)
      .get(`/api/lecturer/history?course_code=${COURSE}&class_id=${CLASS_ID}`)
      .set('Authorization', `Bearer ${lecturerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.students)).toBe(true);
  });

  test('manual override marks a student not in the roster', async () => {
    const res = await request(app)
      .post('/api/attendance/manual')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .send({ session_id: mainSession.session_id, index_number: 'EFLOW003', student_name: 'Eflow Student Three' });
    expect(res.status).toBe(201);
    expect(await dbStamp(mainSession.session_id, 'EFLOW003')).toBe('MANUAL');
  });

  test('duplicate manual override is a 409', async () => {
    const res = await request(app)
      .post('/api/attendance/manual')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .send({ session_id: mainSession.session_id, index_number: 'EFLOW003', student_name: 'Eflow Student Three' });
    expect(res.status).toBe(409);
  });

  test('deactivating a session blocks further check-ins', async () => {
    const end = await request(app)
      .post(`/api/lecturer/deactivate/${throwawaySession.session_id}`)
      .set('Authorization', `Bearer ${lecturerToken}`);
    expect(end.status).toBe(200);

    const res = await request(app)
      .post('/api/attendance/check-in')
      .send({
        name: 'Eflow Student One',
        index_number: 'EFLOW001',
        course_code: COURSE,
        pin: `${COURSE}-${throwawaySession.pin}`,
        latitude: HALL_LAT,
        longitude: HALL_LON,
        accuracy: 5,
        device_fingerprint: 'eflow-fp-dead-session',
      });
    expect(res.status).toBe(404);
  });
});

describe('Student check-in edge cases (geofencing ON)', () => {
  test('validate-pin accepts a valid PIN and reports geofencing on', async () => {
    const res = await request(app)
      .post('/api/attendance/validate-pin')
      .send({ pin: `${COURSE}-${mainSession.pin}`, index_number: 'EFLOW001' });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.geofencing_enabled).toBe(true);
  });

  test('validate-pin rejects an unknown PIN with 404', async () => {
    const res = await request(app)
      .post('/api/attendance/validate-pin')
      .send({ pin: `${COURSE}-000000`, index_number: 'EFLOW001' });
    expect(res.status).toBe(404);
  });

  test('valid check-in inside the fence succeeds', async () => {
    const res = await baseCheckIn({ device_fingerprint: 'eflow-fp-ok' });
    expect(res.status).toBe(201);
    expect(res.body.geofencing_enabled).toBe(true);
    expect(await dbStamp(mainSession.session_id, 'EFLOW001')).toBe('GPS');
  });

  test('duplicate check-in for the same student is a 409', async () => {
    const res = await baseCheckIn({ device_fingerprint: 'eflow-fp-dup' });
    expect(res.status).toBe(409);
  });

  test('wrong PIN is rejected with 404', async () => {
    const res = await baseCheckIn({ pin: `${COURSE}-999999`, device_fingerprint: 'eflow-fp-wrong' });
    expect(res.status).toBe(404);
  });

  test('check-in far outside the fence is a 403', async () => {
    const res = await baseCheckIn({
      name: 'Eflow Student Two',
      index_number: 'EFLOW002',
      latitude: FAR_LAT,
      longitude: FAR_LON,
      device_fingerprint: 'eflow-fp-far',
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Must be within');
  });

  test('missing coordinates on a geofenced session is a 400', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .send({
        name: 'Eflow Student Two',
        index_number: 'EFLOW002',
        course_code: COURSE,
        pin: `${COURSE}-${mainSession.pin}`,
        device_fingerprint: 'eflow-fp-nocoords',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Location is required');
  });

  test('invalid latitude is a 400', async () => {
    const res = await baseCheckIn({ latitude: 'abc', longitude: HALL_LON, device_fingerprint: 'eflow-fp-badlat' });
    expect(res.status).toBe(400);
  });

  test('poor accuracy is a 400', async () => {
    const res = await baseCheckIn({ accuracy: 500, device_fingerprint: 'eflow-fp-badacc' });
    expect(res.status).toBe(400);
  });

  test('index number not in the roster is a 403', async () => {
    const res = await baseCheckIn({ name: 'Ghost Student', index_number: 'GHOST001', device_fingerprint: 'eflow-fp-ghost' });
    expect(res.status).toBe(403);
  });

  test('name not matching the roster is a 400', async () => {
    const res = await baseCheckIn({ name: 'Completely Wrong Name', device_fingerprint: 'eflow-fp-name' });
    expect(res.status).toBe(400);
  });

  test('same device fingerprint for a different student is a 429', async () => {
    const res = await baseCheckIn({
      name: 'Eflow Student Two',
      index_number: 'EFLOW002',
      device_fingerprint: 'eflow-fp-ok', // already used by EFLOW001
    });
    expect(res.status).toBe(429);
    expect(res.body.error).toContain('Device used for another student');
  });
});

describe('Student check-in edge cases (geofencing OFF)', () => {
  test('validate-pin reports geofencing off', async () => {
    const res = await request(app)
      .post('/api/attendance/validate-pin')
      .send({ pin: `${COURSE}-${noGeoSession.pin}`, index_number: 'EFLOW002' });
    expect(res.status).toBe(200);
    expect(res.body.geofencing_enabled).toBe(false);
  });

  test('check-in without coordinates succeeds and is stamped PIN', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .send({
        name: 'Eflow Student Two',
        index_number: 'EFLOW002',
        course_code: COURSE,
        pin: `${COURSE}-${noGeoSession.pin}`,
        device_fingerprint: 'eflow-fp-nogeo-1',
      });
    expect(res.status).toBe(201);
    expect(res.body.geofencing_enabled).toBe(false);
    expect(await dbStamp(noGeoSession.session_id, 'EFLOW002')).toBe('PIN');
  });

  test('check-in with coordinates far outside still succeeds (fence skipped)', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .send({
        name: 'Eflow Student One',
        index_number: 'EFLOW001',
        course_code: COURSE,
        pin: `${COURSE}-${noGeoSession.pin}`,
        latitude: FAR_LAT,
        longitude: FAR_LON,
        accuracy: 5,
        device_fingerprint: 'eflow-fp-nogeo-2',
      });
    expect(res.status).toBe(201);
  });

  test('duplicate check-in on the no-geo session is a 409', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .send({
        name: 'Eflow Student Two',
        index_number: 'EFLOW002',
        course_code: COURSE,
        pin: `${COURSE}-${noGeoSession.pin}`,
        device_fingerprint: 'eflow-fp-nogeo-dup',
      });
    expect(res.status).toBe(409);
  });
});

describe('Cross-role & auth', () => {
  test('lecturer token is rejected on admin routes with 403', async () => {
    const res = await request(app).get('/api/admin/semesters').set('Authorization', `Bearer ${lecturerToken}`);
    expect(res.status).toBe(403);
  });

  test('admin token is rejected on lecturer routes with 403', async () => {
    const res = await request(app)
      .post('/api/lecturer/activate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ course_code: COURSE, class_ids: [CLASS_ID], week_number: 98, lecture_hall_id: 1, duration_minutes: 60 });
    expect(res.status).toBe(403);
  });

  test('missing token on a protected route is a 401', async () => {
    const res = await request(app)
      .post('/api/lecturer/activate')
      .send({ course_code: COURSE, class_ids: [CLASS_ID], week_number: 98, lecture_hall_id: 1, duration_minutes: 60 });
    expect(res.status).toBe(401);
  });

  test('manual override without a lecturer token is a 401', async () => {
    const res = await request(app)
      .post('/api/attendance/manual')
      .send({ session_id: mainSession.session_id, index_number: 'EFLOW001', student_name: 'Eflow Student One' });
    expect(res.status).toBe(401);
  });

  test('invalid/expired token is a 401', async () => {
    const res = await request(app).get('/api/admin/semesters').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});
