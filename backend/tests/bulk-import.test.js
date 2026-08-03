const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/index');
const { pool } = require('../src/config/db');
require('dotenv').config();

const ADMIN_EMAIL = `bulk-import-${Date.now()}@classpulse.com`;
const ADMIN_PASSWORD = 'bulktest123';
const CLASS_NAME = `Bulk Import Test Class ${Date.now()}`;
const INDEX_PREFIX = 'BUIMP';

let adminToken;
let testClassId;
let adminId;

function csv(rows) {
  return rows.join('\n');
}

async function importCsv(content) {
  return request(app)
    .post('/api/admin/students/bulk')
    .set('Authorization', `Bearer ${adminToken}`)
    .field('class_id', String(testClassId))
    .attach('file', Buffer.from(content), 'students.csv');
}

beforeAll(async () => {
  // Department-scoped admin so the bulk import route (non-university only) is allowed
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const adminRes = await pool.query(
    `INSERT INTO admins (name, email, password_hash, role, university_id, school_id, department_id)
     VALUES ($1, $2, $3, 'department', 1, 1, 1) RETURNING id`,
    ['Bulk Import Test Admin', ADMIN_EMAIL, hash]
  );
  adminId = adminRes.rows[0].id;

  const classRes = await pool.query(
    'INSERT INTO classes (class_name, department_id) VALUES ($1, 1) RETURNING class_id',
    [CLASS_NAME]
  );
  testClassId = classRes.rows[0].class_id;

  // Clean up leftovers from previous runs
  await pool.query('DELETE FROM student_roster WHERE index_number LIKE $1', [`${INDEX_PREFIX}%`]);

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  adminToken = login.body.token;
});

afterAll(async () => {
  await pool.query('DELETE FROM student_roster WHERE index_number LIKE $1', [`${INDEX_PREFIX}%`]);
  if (testClassId) await pool.query('DELETE FROM classes WHERE class_id = $1', [testClassId]);
  if (adminId) await pool.query('DELETE FROM admins WHERE id = $1', [adminId]);
  await pool.end();
});

describe('Admin CSV Bulk Import Duplicate Detection', () => {
  test('imports new students', async () => {
    const res = await importCsv(csv([
      'index_number,student_name',
      'BUIMP001,Kofi Mensah (ms)',
      'BUIMP002,Yaw Asante',
    ]));
    expect(res.status).toBe(201);
    expect(res.body.added).toBe(2);
    expect(res.body.errors).toHaveLength(0);

    const check = await pool.query(
      'SELECT student_name FROM student_roster WHERE index_number = $1',
      ['BUIMP001']
    );
    expect(check.rows[0].student_name).toBe('Kofi Mensah (ms)');
  });

  test('re-import with a name missing the (ms) suffix is recognized as the same student and skipped', async () => {
    const res = await importCsv(csv([
      'index_number,student_name',
      'BUIMP001,Kofi Mensah',
    ]));
    expect(res.status).toBe(201);
    expect(res.body.added).toBe(0);
    expect(res.body.skipped).toHaveLength(1);
    expect(res.body.skipped[0].reason).toContain('Already registered');
    expect(res.body.errors).toHaveLength(0);
  });

  test('intra-file duplicate with a suffix variant is skipped, not added twice', async () => {
    const res = await importCsv(csv([
      'index_number,student_name',
      'BUIMP003,Ama Serwaa',
      'BUIMP003,Ama Serwaa (ms)',
    ]));
    expect(res.status).toBe(201);
    expect(res.body.added).toBe(1);
    expect(res.body.skipped).toHaveLength(1);
    expect(res.body.skipped[0].reason).toContain('Duplicate in file');
    expect(res.body.errors).toHaveLength(0);
  });

  test('same index with a genuinely different name is reported as an error', async () => {
    const res = await importCsv(csv([
      'index_number,student_name',
      'BUIMP001,Someone Else Entirely',
    ]));
    expect(res.status).toBe(201);
    expect(res.body.added).toBe(0);
    expect(res.body.skipped).toHaveLength(0);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0].error).toContain('already registered to a different student');
  });
});
