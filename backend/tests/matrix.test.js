const request = require('supertest');
const { pool } = require('../src/config/db');
const app = require('../src/index');
require('dotenv').config();

const TEST_COURSE = 'TMATRIX';
const TEST_CLASS_ID = 1;
const BUILDING_LAT = 5.65;
const BUILDING_LON = -0.186;

let lecturerToken;
let lecturerId;

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'kasante@university.edu', password: 'lecturer123' });
  lecturerToken = loginRes.body.token;
  lecturerId = loginRes.body.user.id;

  // Clean up stale test data
  await pool.query("DELETE FROM attendance_records WHERE index_number = 'MATRIX001'");
  await pool.query("DELETE FROM student_roster WHERE index_number = 'MATRIX001'");
  await pool.query("DELETE FROM active_sessions WHERE course_code = $1", [TEST_COURSE]);

  // Create isolated test course
  await pool.query(
    'INSERT INTO courses (course_code, course_name, total_weeks) VALUES ($1, $2, $3) ON CONFLICT (course_code) DO UPDATE SET total_weeks = $3',
    [TEST_COURSE, 'Test Matrix Course', 12]
  );
  await pool.query(
    'INSERT INTO course_lecturers (course_code, lecturer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [TEST_COURSE, lecturerId]
  );
  await pool.query(
    'INSERT INTO class_lecturers (class_id, lecturer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [TEST_CLASS_ID, lecturerId]
  );

  // Add test student to roster
  await pool.query(
    "INSERT INTO student_roster (index_number, student_name, class_id) VALUES ($1, $2, $3) ON CONFLICT (index_number) DO NOTHING",
    ['MATRIX001', 'Matrix Student 1', TEST_CLASS_ID]
  );
});

afterAll(async () => {
  await pool.query("DELETE FROM active_sessions WHERE course_code = $1", [TEST_COURSE]);
  await pool.query("DELETE FROM student_roster WHERE index_number = 'MATRIX001'");
  await pool.query('DELETE FROM course_lecturers WHERE course_code = $1', [TEST_COURSE]);
  await pool.query('DELETE FROM class_lecturers WHERE class_id = $1 AND lecturer_id = $2', [TEST_CLASS_ID, lecturerId]);
  await pool.query("DELETE FROM courses WHERE course_code = $1", [TEST_COURSE]);
  await pool.end();
});

async function createSession(week) {
  const res = await request(app)
    .post('/api/lecturer/activate')
    .set('Authorization', `Bearer ${lecturerToken}`)
    .send({
      course_code: TEST_COURSE,
      class_ids: [TEST_CLASS_ID],
      week_number: week,
      building_id: 1,
      duration_minutes: 30,
    });
  return res.body.sessions[0];
}

async function submitAttendance(pin, indexNumber, name, fp) {
  return request(app)
    .post('/api/attendance')
    .send({
      name,
      index_number: indexNumber,
      course_code: TEST_COURSE,
      pin,
      latitude: BUILDING_LAT,
      longitude: BUILDING_LON,
      device_fingerprint: fp,
    });
}

describe('Attendance Matrix Cross-Week Validation', () => {
  let sessionWeek1, sessionWeek3;

  beforeAll(async () => {
    sessionWeek1 = await createSession(1);
    sessionWeek3 = await createSession(3);
  });

  test('matrix shows present for attended week', async () => {
    const att1 = await submitAttendance(sessionWeek1.pin, 'MATRIX001', 'Matrix Student 1', 'matrix-fp-1');
    expect(att1.status).toBe(201);

    const att2 = await submitAttendance(sessionWeek3.pin, 'MATRIX001', 'Matrix Student 1', 'matrix-fp-2');
    expect(att2.status).toBe(201);

    const historyRes = await request(app)
      .get(`/api/lecturer/history?course_code=${TEST_COURSE}&class_id=${TEST_CLASS_ID}`)
      .set('Authorization', `Bearer ${lecturerToken}`);

    expect(historyRes.status).toBe(200);
    const student = historyRes.body.students.find(s => s.index_number === 'MATRIX001');
    expect(student).toBeDefined();
    expect(historyRes.body.matrix[student.id][1]).toBe('present');
    expect(historyRes.body.matrix[student.id][3]).toBe('present');
  });

  test('matrix shows absent for week with session but no attendance', async () => {
    const historyRes = await request(app)
      .get(`/api/lecturer/history?course_code=${TEST_COURSE}&class_id=${TEST_CLASS_ID}`)
      .set('Authorization', `Bearer ${lecturerToken}`);

    expect(historyRes.body.active_weeks).toContain(1);
    expect(historyRes.body.active_weeks).toContain(3);

    for (const s of historyRes.body.students) {
      if (s.index_number === 'MATRIX001') continue;
      expect(historyRes.body.matrix[s.id][1]).toBe('absent');
      expect(historyRes.body.matrix[s.id][3]).toBe('absent');
    }
  });

  test('matrix shows future for week without session', async () => {
    const historyRes = await request(app)
      .get(`/api/lecturer/history?course_code=${TEST_COURSE}&class_id=${TEST_CLASS_ID}`)
      .set('Authorization', `Bearer ${lecturerToken}`);

    for (const student of historyRes.body.students) {
      expect(historyRes.body.matrix[student.id][2]).toBe('future');
      if (historyRes.body.weeks.length >= 4) {
        expect(historyRes.body.matrix[student.id][4]).toBe('future');
      }
    }
  });

  test('percentage is correct for student with full attendance', async () => {
    const historyRes = await request(app)
      .get(`/api/lecturer/history?course_code=${TEST_COURSE}&class_id=${TEST_CLASS_ID}`)
      .set('Authorization', `Bearer ${lecturerToken}`);

    const student = historyRes.body.students.find(s => s.index_number === 'MATRIX001');
    expect(student).toBeDefined();
    expect(historyRes.body.percentages[student.id]).toBe(100);
  });

  test('percentage is 0 for student with no attendance in active weeks', async () => {
    const historyRes = await request(app)
      .get(`/api/lecturer/history?course_code=${TEST_COURSE}&class_id=${TEST_CLASS_ID}`)
      .set('Authorization', `Bearer ${lecturerToken}`);

    for (const s of historyRes.body.students) {
      if (s.index_number === 'MATRIX001') continue;
      expect(historyRes.body.percentages[s.id]).toBe(0);
    }
  });

  test('CSV export returns correct headers and data', async () => {
    const res = await request(app)
      .get(`/api/lecturer/history/export?course_code=${TEST_COURSE}&class_id=${TEST_CLASS_ID}`)
      .set('Authorization', `Bearer ${lecturerToken}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    const buf = res.body;
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet('Attendance');
    expect(ws).toBeDefined();
    const allValues = [];
    ws.eachRow({ includeEmpty: false }, (r) => {
      r.eachCell((c) => allValues.push(c.value));
    });
    ['Index Number', 'Student Name', 'Attendance %', TEST_COURSE].forEach(key => {
      expect(allValues.some(v => String(v).includes(String(key)))).toBe(true);
    });
    expect(allValues.some(v => String(v).includes('MATRIX001'))).toBe(true);
    let found100 = false;
    ws.eachRow({ includeEmpty: false }, (r) => {
      let lastVal = null;
      r.eachCell((c) => { lastVal = c.value; });
      if (String(lastVal).endsWith('%') && String(lastVal).startsWith('100')) found100 = true;
    });
    expect(found100).toBe(true);
  });
});
