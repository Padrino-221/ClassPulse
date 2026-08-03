const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/index');
const { pool } = require('../src/config/db');
require('dotenv').config();

const DEPT_EMAIL = `bulk-dept-${Date.now()}@classpulse.com`;
const SCHOOL_EMAIL = `bulk-school-${Date.now()}@classpulse.com`;
const PASSWORD = 'bulktest123';
const EMAIL_PREFIX = `lecimp-${Date.now()}`;

let deptToken;
let schoolToken;
let deptAdminId;
let schoolAdminId;

function csv(rows) {
  return rows.join('\n');
}

async function importLecturers(content, token) {
  return request(app)
    .post('/api/admin/lecturers/bulk')
    .set('Authorization', `Bearer ${token || deptToken}`)
    .attach('file', Buffer.from(content), 'lecturers.csv');
}

beforeAll(async () => {
  const hash = await bcrypt.hash(PASSWORD, 10);

  const deptRes = await pool.query(
    `INSERT INTO admins (name, email, password_hash, role, university_id, school_id, department_id)
     VALUES ($1, $2, $3, 'department', 1, 1, 1) RETURNING id`,
    ['Bulk Import Dept Admin', DEPT_EMAIL, hash]
  );
  deptAdminId = deptRes.rows[0].id;

  const schoolRes = await pool.query(
    `INSERT INTO admins (name, email, password_hash, role, university_id, school_id)
     VALUES ($1, $2, $3, 'school', 1, 1) RETURNING id`,
    ['Bulk Import School Admin', SCHOOL_EMAIL, hash]
  );
  schoolAdminId = schoolRes.rows[0].id;

  const deptLogin = await request(app).post('/api/auth/login').send({ email: DEPT_EMAIL, password: PASSWORD });
  deptToken = deptLogin.body.token;
  const schoolLogin = await request(app).post('/api/auth/login').send({ email: SCHOOL_EMAIL, password: PASSWORD });
  schoolToken = schoolLogin.body.token;
});

afterAll(async () => {
  // Clean any tokens created for imported lecturers, then the lecturers themselves
  await pool.query(
    `DELETE FROM password_reset_tokens WHERE user_type = 'lecturer'
     AND user_id IN (SELECT id FROM lecturers WHERE email LIKE $1)`,
    [`${EMAIL_PREFIX}%`]
  );
  await pool.query('DELETE FROM lecturers WHERE email LIKE $1', [`${EMAIL_PREFIX}%`]);
  if (deptAdminId) await pool.query('DELETE FROM admins WHERE id = $1', [deptAdminId]);
  if (schoolAdminId) await pool.query('DELETE FROM admins WHERE id = $1', [schoolAdminId]);
  await pool.end();
});

describe('Department Admin Bulk Lecturer Import', () => {
  test('imports new lecturer accounts with hashed passwords', async () => {
    const emails = [`${EMAIL_PREFIX}-jane@example.com`, `${EMAIL_PREFIX}-john@example.com`];
    const res = await importLecturers(csv([
      'name,email,password',
      `Dr. Jane Doe,${emails[0]},TemporaryPass1`,
      `Prof. John Smith,${emails[1]},TemporaryPass2`,
    ]));
    expect(res.status).toBe(201);
    expect(res.body.added).toBe(2);
    expect(res.body.errors).toHaveLength(0);

    const rows = await pool.query(
      'SELECT email, department_id FROM lecturers WHERE email = ANY($1)',
      [emails]
    );
    expect(rows.rows).toHaveLength(2);
    for (const r of rows.rows) {
      expect(Number(r.department_id)).toBe(1);
    }
  });

  test('duplicate email within the same file is skipped, not added twice', async () => {
    const email = `${EMAIL_PREFIX}-ama@example.com`;
    const res = await importLecturers(csv([
      'name,email,password',
      `Ama Serwaa,${email},TemporaryPass1`,
      `Ama Again,${email},TemporaryPass2`,
    ]));
    expect(res.status).toBe(201);
    expect(res.body.added).toBe(1);
    expect(res.body.skipped).toHaveLength(1);
    expect(res.body.skipped[0].reason).toContain('Duplicate in file');
    expect(res.body.errors).toHaveLength(0);
  });

  test('an email that is already registered is skipped as already registered', async () => {
    const email = `${EMAIL_PREFIX}-kofi@example.com`;
    // Import first, then import the same email again
    await importLecturers(csv([
      'name,email,password',
      `Kofi Mensah,${email},TemporaryPass1`,
    ]));
    const res = await importLecturers(csv([
      'name,email,password',
      `Kofi Mensah,${email},TemporaryPass2`,
    ]));
    expect(res.status).toBe(201);
    expect(res.body.added).toBe(0);
    expect(res.body.skipped).toHaveLength(1);
    expect(res.body.skipped[0].reason).toContain('Already registered');
  });

  test('rows with short passwords or bad emails are reported as errors', async () => {
    const res = await importLecturers(csv([
      'name,email,password',
      `Short Pass,${EMAIL_PREFIX}-short@example.com,short`,
      `Bad Email,${EMAIL_PREFIX}-bad,TemporaryPass1`,
    ]));
    expect(res.status).toBe(201);
    expect(res.body.added).toBe(0);
    expect(res.body.errors).toHaveLength(2);
  });

  test('an oversized email is a per-row error and does not abort the batch', async () => {
    const longEmail = `${EMAIL_PREFIX}${'a'.repeat(250)}@example.com`;
    const res = await importLecturers(csv([
      'name,email,password',
      `Valid Row,${EMAIL_PREFIX}-valid@example.com,TemporaryPass1`,
      `Too Long,${longEmail},TemporaryPass1`,
    ]));
    expect(res.status).toBe(201);
    expect(res.body.added).toBe(1);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0].error).toContain('too long');
  });

  test('a CSV missing the password column is rejected', async () => {
    const res = await importLecturers(csv([
      'name,email',
      `No Password,${EMAIL_PREFIX}-nopw@example.com`,
    ]));
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('password');
  });

  test('returns 403 for school admins (bulk lecturer import is department-admin only)', async () => {
    const res = await importLecturers(csv([
      'name,email,password',
      `School Level,${EMAIL_PREFIX}-school@example.com,TemporaryPass1`,
    ]), schoolToken);
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('department admins');
  });
});
