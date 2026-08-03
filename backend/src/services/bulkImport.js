const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { namesMatch } = require('./nameMatch');
const { sendWelcomeEmail } = require('./mailer');

// Shared CSV student-roster bulk import used by both the admin and lecturer
// routes so the parsing, dedupe, and conflict rules can never drift apart.
//
// Parses the CSV, validates the header, dedupes within the file
// (suffix-tolerant, e.g. "X (ms)" vs "X"), then persists with batched SQL:
//  1) soft-deleted records are restored in one lookup + per-row UPDATE
//  2) everything else is inserted in a single INSERT ... ON CONFLICT DO NOTHING
//  3) active-roster conflicts are resolved in one batched lookup
//
// Returns { added, skipped, errors } where `added` is the array of inserted
// rows, or { error } when the CSV itself is unusable.
async function importStudentRoster(pool, classId, content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { error: 'CSV needs a header row.' };

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  function findCol(...candidates) {
    for (const c of candidates) {
      const i = headers.indexOf(c);
      if (i !== -1) return i;
    }
    return -1;
  }
  const idxIdx = findCol('index_number', 'index number', 'index');
  const nameIdx = findCol('student_name', 'student name', 'name');
  if (idxIdx === -1 || nameIdx === -1) {
    return { error: 'CSV needs index_number and student_name columns.' };
  }

  const added = [];
  const skipped = [];
  const errors = [];
  // index_number → { studentName } for rows already seen in this file
  const seenIndexes = new Map();
  // Rows that passed intra-file dedupe, still to be persisted
  const pending = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const indexNumber = cols[idxIdx];
    const studentName = cols[nameIdx];
    if (!indexNumber || !studentName) {
      errors.push({ row: i + 1, index_number: indexNumber || null, error: 'Missing fields.' });
      continue;
    }

    // Duplicate index within the same file — same student when the name
    // matches suffix-tolerantly (e.g. "X (ms)" vs "X")
    if (seenIndexes.has(indexNumber)) {
      const prev = seenIndexes.get(indexNumber);
      if (namesMatch(studentName, prev.studentName)) {
        skipped.push({ row: i + 1, index_number: indexNumber, reason: 'Duplicate in file.' });
      } else {
        errors.push({ row: i + 1, index_number: indexNumber, error: `Index ${indexNumber} already used for "${prev.studentName}" in this file.` });
      }
      continue;
    }

    seenIndexes.set(indexNumber, { studentName });
    pending.push({ row: i + 1, indexNumber, studentName });
  }

  // Batch-persist the remaining rows: restore soft-deleted records, bulk-insert
  // the rest, then resolve active-roster conflicts — avoids N×(SELECT+INSERT)
  // round-trips for large files.
  if (pending.length > 0) {
    // 1) Restore soft-deleted records (one lookup for the whole file)
    const softDeleted = await pool.query(
      'SELECT id, index_number FROM student_roster WHERE index_number = ANY($1) AND deleted_at IS NOT NULL',
      [pending.map((p) => p.indexNumber)]
    );
    const softDeletedIds = new Map(softDeleted.rows.map((r) => [r.index_number, r.id]));
    const toRestore = pending.filter((p) => softDeletedIds.has(p.indexNumber));
    const toInsert = pending.filter((p) => !softDeletedIds.has(p.indexNumber));

    for (const p of toRestore) {
      const res = await pool.query(
        'UPDATE student_roster SET student_name = $1, class_id = $2, deleted_at = NULL WHERE id = $3 RETURNING *',
        [p.studentName, classId, softDeletedIds.get(p.indexNumber)]
      );
      if (res.rows[0]) added.push(res.rows[0]);
    }

    // 2) Single bulk insert for everything else — indexes already active are
    //    skipped by the partial unique index instead of aborting the batch.
    if (toInsert.length > 0) {
      const placeholders = [];
      const values = [];
      for (let i = 0; i < toInsert.length; i++) {
        const base = i * 3;
        placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
        values.push(toInsert[i].indexNumber, toInsert[i].studentName, classId);
      }
      const inserted = await pool.query(
        `INSERT INTO student_roster (index_number, student_name, class_id)
         VALUES ${placeholders.join(', ')}
         ON CONFLICT (index_number) WHERE deleted_at IS NULL DO NOTHING
         RETURNING index_number, student_name, class_id`,
        values
      );
      const insertedIndexes = new Set(inserted.rows.map((r) => r.index_number));
      for (const r of inserted.rows) added.push(r);

      // 3) Resolve active-roster conflicts in one batched lookup
      const conflicts = toInsert.filter((p) => !insertedIndexes.has(p.indexNumber));
      if (conflicts.length > 0) {
        const active = await pool.query(
          'SELECT index_number, student_name FROM student_roster WHERE index_number = ANY($1) AND deleted_at IS NULL',
          [conflicts.map((p) => p.indexNumber)]
        );
        const activeNames = new Map(active.rows.map((r) => [r.index_number, r.student_name]));
        for (const p of conflicts) {
          const existingName = activeNames.get(p.indexNumber);
          if (existingName && namesMatch(p.studentName, existingName)) {
            skipped.push({ row: p.row, index_number: p.indexNumber, reason: 'Already registered.' });
          } else {
            errors.push({ row: p.row, index_number: p.indexNumber, error: `Index ${p.indexNumber} is already registered to a different student.` });
          }
        }
      }
    }
  }

  return { added, skipped, errors };
}

// Runs an async fn over items with at most `limit` concurrent executions.
// bcrypt hashing is CPU-bound, so hashing a large CSV in one Promise.all would
// peg the CPU; a small window keeps imports snappy without starving the box.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Bulk-creates lecturer accounts for a department admin from a CSV with
// name,email,password columns. Mirrors the single-lecturer-create rules
// (password >= 8 chars, active-email uniqueness) and fires a welcome email
// (with a reset token) for each account that is actually created.
//
// Returns { added, skipped, errors } where `added` is the array of created
// rows, or { error } when the CSV itself is unusable.
async function importLecturers(pool, content, departmentId) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { error: 'CSV needs a header row.' };

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  function findCol(...candidates) {
    for (const c of candidates) {
      const i = headers.indexOf(c);
      if (i !== -1) return i;
    }
    return -1;
  }
  const nameIdx = findCol('name', 'full name', 'lecturer name');
  const emailIdx = findCol('email', 'email address');
  const passwordIdx = findCol('password');
  if (nameIdx === -1 || emailIdx === -1 || passwordIdx === -1) {
    return { error: 'CSV needs name, email and password columns.' };
  }

  const added = [];
  const skipped = [];
  const errors = [];
  // normalized (lowercased) email → { studentName: '' } marker for in-file dedupe
  const seenEmails = new Map();
  const pending = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const name = cols[nameIdx];
    const email = (cols[emailIdx] || '').toLowerCase();
    const password = cols[passwordIdx];
    const row = i + 1;

    if (!name || !email || !password) {
      errors.push({ row, email: email || null, error: 'Missing fields.' });
      continue;
    }
    // Column-length guards keep a single oversized row from aborting the whole
    // batched INSERT (which would 500 the import instead of reporting per-row).
    if (name.length > 255) {
      errors.push({ row, email, error: 'Name is too long (max 255 characters).' });
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push({ row, email, error: `Invalid email "${email}".` });
      continue;
    }
    if (email.length > 255) {
      errors.push({ row, email, error: 'Email is too long (max 255 characters).' });
      continue;
    }
    // Mirrors the single-lecturer-create validation (min 8, max 128)
    if (password.length < 8 || password.length > 128) {
      errors.push({ row, email, error: 'Password must be 8–128 characters.' });
      continue;
    }

    if (seenEmails.has(email)) {
      skipped.push({ row, email, reason: 'Duplicate in file.' });
      continue;
    }
    seenEmails.set(email, true);
    pending.push({ row, name, email, password });
  }

  if (pending.length > 0) {
    // 1) Skip emails already active in the system (one batched lookup)
    const existing = await pool.query(
      'SELECT email FROM lecturers WHERE email = ANY($1) AND deleted_at IS NULL',
      [pending.map((p) => p.email)]
    );
    const existingEmails = new Set(existing.rows.map((r) => r.email.toLowerCase()));
    const toInsert = [];
    for (const p of pending) {
      if (existingEmails.has(p.email)) {
        skipped.push({ row: p.row, email: p.email, reason: 'Already registered.' });
      } else {
        toInsert.push(p);
      }
    }

    // 2) Hash passwords with a small concurrency window
    const hashed = await mapWithConcurrency(toInsert, 8, async (p) => ({
      ...p,
      hash: await bcrypt.hash(p.password, 10),
    }));

    // 3) Single bulk insert; any email that raced in is skipped by the partial
    //    unique index instead of aborting the batch.
    if (hashed.length > 0) {
      const placeholders = [];
      const values = [];
      for (let i = 0; i < hashed.length; i++) {
        const base = i * 4;
        placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
        values.push(hashed[i].name, hashed[i].email, hashed[i].hash, departmentId);
      }
      const inserted = await pool.query(
        `INSERT INTO lecturers (name, email, password_hash, department_id)
         VALUES ${placeholders.join(', ')}
         ON CONFLICT (email) WHERE deleted_at IS NULL DO NOTHING
         RETURNING id, name, email, created_at`,
        values
      );
      const insertedRows = inserted.rows;
      added.push(...insertedRows);

      const insertedEmails = new Set(insertedRows.map((r) => r.email.toLowerCase()));
      for (const p of hashed) {
        if (!insertedEmails.has(p.email)) {
          skipped.push({ row: p.row, email: p.email, reason: 'Already registered.' });
        }
      }

      // 4) Welcome emails with a reset token, fire-and-forget like single create
      for (const r of insertedRows) {
        const resetToken = crypto.randomBytes(32).toString('hex');
        pool.query(
          'INSERT INTO password_reset_tokens (user_type, user_id, token) VALUES ($1, $2, $3)',
          ['lecturer', r.id, resetToken]
        ).then(() => sendWelcomeEmail(r.email, r.name, r.email, resetToken)).catch((err) => {
          console.error('Welcome email failed:', err.message);
        });
      }
    }
  }

  return { added, skipped, errors };
}

module.exports = { importStudentRoster, importLecturers };
