require('dotenv').config();
const request = require('supertest');
const app = require('../src/index');
const { pool } = require('../src/config/db');

const TEST_COURSE = 'TST187';
const NUM_STUDENTS = 187;
const WAVE_SIZE = 20;
const NO_GEO_STUDENTS = 40;   // smaller PIN-only wave for the geofencing-off phase
const NO_GEO_WAVE = 20;

let BUILDING_LAT = 7.363042;
let BUILDING_LON = -2.351278;
let TEST_CLASS_ID = null;

const results = { total: 0, ok: 0, latencies: [], byStatus: {}, errors: {} };
const noGeoResults = { total: 0, ok: 0, latencies: [], byStatus: {}, errors: {} };

function elapsedMs(t0) {
  return Number(process.hrtime.bigint() - t0) / 1e6;
}

function stats(arr) {
  if (arr.length === 0) return 'n/a';
  const sorted = [...arr].sort((a, b) => a - b);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const max = sorted[sorted.length - 1];
  return `avg ${avg.toFixed(0)}ms | p50 ${pct(50).toFixed(0)}ms | p95 ${pct(95).toFixed(0)}ms | p99 ${pct(99).toFixed(0)}ms | max ${max.toFixed(0)}ms`;
}

function record(acc, res, ms) {
  acc.total++;
  acc.latencies.push(ms);
  acc.byStatus[res.status] = (acc.byStatus[res.status] || 0) + 1;
  if (res.status === 201) {
    acc.ok++;
  } else {
    const errKey = `${res.status}:${(res.body.error || 'unknown').slice(0, 60)}`;
    acc.errors[errKey] = (acc.errors[errKey] || 0) + 1;
  }
}

async function checkIn(acc, { name, index_number, pin, fingerprint, coords }) {
  const t0 = process.hrtime.bigint();
  const res = await request(app)
    .post('/api/attendance/check-in')
    .send({
      name,
      index_number,
      pin,
      accuracy: 5,
      device_fingerprint: fingerprint,
      ...(coords || {}),
    });
  const ms = elapsedMs(t0);
  record(acc, res, ms);
  return { status: res.status, ms, body: res.body };
}

function reportPhase(title, acc, expected) {
  const okRate = acc.ok / Math.max(expected, 1);
  console.log(`\n--- ${title} ---`);
  console.log('Check-ins sent:      ', acc.total);
  console.log('Successful (201):    ', acc.ok, `(${(okRate * 100).toFixed(1)}%)`);
  console.log('Status distribution: ', JSON.stringify(acc.byStatus));
  if (Object.keys(acc.errors).length > 0) {
    console.log('Failures:');
    for (const [k, v] of Object.entries(acc.errors)) console.log(`  ${v}x  ${k}`);
  }
  console.log('Latency:             ', stats(acc.latencies));
}

(async () => {
  const tStart = process.hrtime.bigint();
  let lecturerToken, lecturerId, courseId, sessionId, sessionPin, noGeoSessionId, students;

  try {
    // 1. Login
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'kasante@university.edu', password: 'lecturer123' });
    if (login.status !== 200) throw new Error(`Login failed: ${login.status} ${JSON.stringify(login.body)}`);
    lecturerToken = login.body.token;
    lecturerId = login.body.user.id;
    console.log('1. Login OK');

    // 1b. Resolve the class with the most roster students + its lecture hall
    const classRes = await pool.query(
      `SELECT class_id FROM student_roster
       WHERE deleted_at IS NULL
       GROUP BY class_id
       ORDER BY COUNT(*) DESC
       LIMIT 1`
    );
    TEST_CLASS_ID = classRes.rows[0].class_id;
    const hallRes = await pool.query(
      `SELECT latitude, longitude FROM lecture_halls
       WHERE deleted_at IS NULL
       ORDER BY id LIMIT 1`
    );
    if (hallRes.rows[0]) {
      BUILDING_LAT = parseFloat(hallRes.rows[0].latitude);
      BUILDING_LON = parseFloat(hallRes.rows[0].longitude);
    }
    console.log('1b. Using class', TEST_CLASS_ID, 'at', BUILDING_LAT + ',' + BUILDING_LON);

    // 1c. Clean any stale sessions from a previously interrupted run
    await pool.query('DELETE FROM active_sessions WHERE course_code = $1', [TEST_COURSE]);
    console.log('1c. Stale TST187 sessions cleaned');

    // 2. Upsert test course + assign to lecturer
    await pool.query(
      `INSERT INTO courses (course_code, course_name, total_weeks)
       VALUES ($1, $2, $3)
       ON CONFLICT (course_code) WHERE deleted_at IS NULL
       DO UPDATE SET total_weeks = EXCLUDED.total_weeks`,
      [TEST_COURSE, '187-Student Load Test Course', 16]
    );
    const c = await pool.query('SELECT id FROM courses WHERE course_code = $1 AND deleted_at IS NULL', [TEST_COURSE]);
    courseId = c.rows[0].id;
    await pool.query(
      'INSERT INTO course_lecturers (course_id, lecturer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [courseId, lecturerId]
    );
    console.log('2. Test course ready (id', courseId + ')');

    // 3. Activate a session (geofencing ON by default)
    const activate = await request(app)
      .post('/api/lecturer/activate')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .send({
        course_code: TEST_COURSE,
        class_ids: [TEST_CLASS_ID],
        week_number: 60,
        lecture_hall_id: 1,
        duration_minutes: 30,
      });
    if (activate.status !== 201 && activate.status !== 200) {
      throw new Error(`Activate failed: ${activate.status} ${JSON.stringify(activate.body)}`);
    }
    sessionId = activate.body.sessions[0].session_id;
    sessionPin = activate.body.sessions[0].pin;
    console.log('3. Session active:', sessionId, '| PIN:', TEST_COURSE + '-' + sessionPin, '| geofencing:', activate.body.sessions[0].geofencing_enabled);

    // 4. Load real roster students from the class
    const roster = await pool.query(
      `SELECT index_number, student_name FROM student_roster
       WHERE class_id = $1 AND deleted_at IS NULL
       ORDER BY index_number
       LIMIT $2`,
      [TEST_CLASS_ID, NUM_STUDENTS]
    );
    students = roster.rows;
    console.log(`4. Loaded ${students.length} roster students (class ${TEST_CLASS_ID})`);

    // 5. Validate-PIN sample (first 10) — exercises the validate-pin endpoint
    let vpOK = 0;
    for (const s of students.slice(0, 10)) {
      const vp = await request(app)
        .post('/api/attendance/validate-pin')
        .send({ pin: `${TEST_COURSE}-${sessionPin}` });
      if (vp.status === 200 && vp.body.valid) vpOK++;
    }
    console.log(`5. validate-pin sample: ${vpOK}/10 valid`);

    // 6. Concurrent check-in load test (geofencing ON, all in-fence)
    console.log(`6. Running ${students.length} check-ins in waves of ${WAVE_SIZE}...`);
    const tLoad = process.hrtime.bigint();
    for (let i = 0; i < students.length; i += WAVE_SIZE) {
      const wave = students.slice(i, i + WAVE_SIZE);
      await Promise.all(
        wave.map((s, k) =>
          checkIn(results, {
            name: s.student_name,
            index_number: s.index_number,
            pin: `${TEST_COURSE}-${sessionPin}`,
            fingerprint: `load-test-fp-${s.index_number}-${Date.now()}`,
            coords: { latitude: BUILDING_LAT, longitude: BUILDING_LON },
          })
        )
      );
    }
    const loadSeconds = Number(process.hrtime.bigint() - tLoad) / 1e9;

    // 7. Duplicate check-in rejection
    const dupFp = `dup-fp-${Date.now()}`;
    const dup = await checkIn(results, {
      name: students[0].student_name,
      index_number: students[0].index_number,
      pin: `${TEST_COURSE}-${sessionPin}`,
      fingerprint: dupFp,
      coords: { latitude: BUILDING_LAT, longitude: BUILDING_LON },
    });

    // 8. Geofencing-OFF phase: PIN-only check-ins with NO coordinates
    console.log(`\n8. Activating geofencing-off session...`);
    const noGeoActivate = await request(app)
      .post('/api/lecturer/activate')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .send({
        course_code: TEST_COURSE,
        class_ids: [TEST_CLASS_ID],
        week_number: 61,
        lecture_hall_id: 1,
        geofencing_enabled: false,
        duration_minutes: 30,
      });
    if (noGeoActivate.status !== 201 && noGeoActivate.status !== 200) {
      throw new Error(`No-geo activate failed: ${noGeoActivate.status} ${JSON.stringify(noGeoActivate.body)}`);
    }
    noGeoSessionId = noGeoActivate.body.sessions[0].session_id;
    const noGeoPin = noGeoActivate.body.sessions[0].pin;
    if (noGeoActivate.body.sessions[0].geofencing_enabled !== false) {
      throw new Error('Expected geofencing_enabled=false on the no-geo session');
    }
    console.log(`8. No-geo session active: ${noGeoSessionId} | PIN: ${TEST_COURSE}-${noGeoPin}`);

    const noGeoStudents = students.slice(0, NO_GEO_STUDENTS);
    console.log(`   Running ${noGeoStudents.length} PIN-only check-ins (no coordinates)...`);
    const tNoGeo = process.hrtime.bigint();
    for (let i = 0; i < noGeoStudents.length; i += NO_GEO_WAVE) {
      const wave = noGeoStudents.slice(i, i + NO_GEO_WAVE);
      await Promise.all(
        wave.map((s) =>
          checkIn(noGeoResults, {
            name: s.student_name,
            index_number: s.index_number,
            pin: `${TEST_COURSE}-${noGeoPin}`,
            fingerprint: `no-geo-fp-${s.index_number}-${Date.now()}`,
            // NOTE: no coords — geofencing is off so the backend must accept it
          })
        )
      );
    }
    const noGeoSeconds = Number(process.hrtime.bigint() - tNoGeo) / 1e9;

    // 8b. Verify PIN stamping in the DB for the no-geo session
    const stampRes = await pool.query(
      `SELECT verification_method, COUNT(*)::int AS cnt
       FROM attendance_records WHERE session_id = $1
       GROUP BY verification_method`,
      [noGeoSessionId]
    );
    const stamps = Object.fromEntries(stampRes.rows.map((r) => [r.verification_method, r.cnt]));
    console.log('   DB verification stamps (no-geo session):', JSON.stringify(stamps));

    // 9. Report
    console.log('\n===== LOAD TEST RESULTS =====');
    reportPhase('Phase A: geofencing ON (in-fence, with coords)', results, students.length);
    console.log('Wall time:           ', loadSeconds.toFixed(2) + 's');
    console.log('Throughput:          ', (results.ok / loadSeconds).toFixed(1), 'check-ins/sec');
    console.log('Duplicate re-submit: ', dup.status === 409 ? 'OK (409 rejected)' : `UNEXPECTED ${dup.status}`);

    reportPhase('Phase B: geofencing OFF (PIN-only, no coords)', noGeoResults, noGeoStudents.length);
    console.log('Wall time:           ', noGeoSeconds.toFixed(2) + 's');
    console.log('Throughput:          ', (noGeoResults.ok / noGeoSeconds).toFixed(1), 'check-ins/sec');
    console.log('PIN stamping:        ', stamps.PIN === noGeoResults.ok ? `OK (${stamps.PIN} PIN records)` : `UNEXPECTED ${JSON.stringify(stamps)}`);

    // Verify DB count for phase A
    const dbCount = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM attendance_records WHERE session_id = $1',
      [sessionId]
    );
    console.log('DB attendance rows (phase A): ', dbCount.rows[0].cnt);

    const pass = results.ok >= students.length * 0.9 && noGeoResults.ok >= noGeoStudents.length * 0.9;
    console.log(`\nOVERALL: ${pass ? 'PASS' : 'FAIL'} (phase A ${results.ok}/${students.length}, phase B ${noGeoResults.ok}/${noGeoStudents.length})`);
    process.exit(pass ? 0 : 2);
  } catch (e) {
    console.error('\nFATAL:', e.message);
    if (e.stack) console.error(e.stack.split('\n').slice(0, 3).join('\n'));
    process.exit(3);
  } finally {
    // Cleanup
    try {
      if (sessionId) {
        await pool.query('DELETE FROM attendance_records WHERE session_id = $1', [sessionId]);
        await pool.query('DELETE FROM active_sessions WHERE session_id = $1', [sessionId]);
      }
      if (noGeoSessionId) {
        await pool.query('DELETE FROM attendance_records WHERE session_id = $1', [noGeoSessionId]);
        await pool.query('DELETE FROM active_sessions WHERE session_id = $1', [noGeoSessionId]);
      }
      if (courseId) {
        await pool.query('DELETE FROM course_lecturers WHERE course_id = $1', [courseId]);
        await pool.query('DELETE FROM courses WHERE course_code = $1', [TEST_COURSE]);
      }
      await pool.end();
      console.log('\nCleanup done. Total runtime:', (Number(process.hrtime.bigint() - tStart) / 1e9).toFixed(2) + 's');
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr.message);
      await pool.end();
    }
  }
})();
