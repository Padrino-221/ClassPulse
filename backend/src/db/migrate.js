const fs = require('fs');
const path = require('path');

/**
 * Runs schema.sql (base) then pending SQL migrations against the pool.
 * Creates a schema_migrations table to track applied files.
 * Idempotent — safe to call on every startup.
 * Continues past individual failures so the server can start.
 */
async function runMigrations(pool) {
  const migrationsDir = path.join(__dirname, 'migrations');
  const schemaPath = path.join(__dirname, 'schema.sql');

  // Ensure tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         SERIAL PRIMARY KEY,
      filename   TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const { rows: applied } = await pool.query('SELECT filename FROM schema_migrations');
  const appliedSet = new Set(applied.map(r => r.filename));

  let count = 0;
  const failed = [];

  async function runSql(label, sql) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [label]);
      await client.query('COMMIT');
      console.log(`Migration: ${label} applied.`);
      count++;
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Migration: ${label} FAILED — ${err.message}`);
      failed.push(label);
      return false;
    } finally {
      client.release();
    }
  }

  // Run base schema.sql first (for fresh installs)
  if (!appliedSet.has('schema.sql') && fs.existsSync(schemaPath)) {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    console.log('Migration: running schema.sql (base schema) ...');
    await runSql('schema.sql', sql);
  }

  // Run incremental migrations
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found, skipping.');
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Migration: running ${file} ...`);
    await runSql(file, sql);
  }

  if (count === 0 && failed.length === 0) {
    console.log('Migrations: all up to date.');
  } else {
    console.log(`Migrations: ${count} applied, ${failed.length} failed.`);
    if (failed.length > 0) {
      console.error('Failed migrations:', failed.join(', '));
    }
  }
}

module.exports = { runMigrations };
