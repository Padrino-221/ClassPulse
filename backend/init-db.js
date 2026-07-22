require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function splitSql(sql) {
  return sql
    .split(/;\s*(?=(?:[^']*'[^']*')*[^']*$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function main() {
  const schemaSql = fs.readFileSync(path.join(__dirname, 'src', 'db', 'schema.sql'), 'utf8');
  const statements = splitSql(schemaSql);

  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

  for (const statement of statements) {
    await pool.query(statement);
  }

  const tableCheck = await pool.query(
    "SELECT to_regclass('public.active_sessions') AS active_sessions_exists"
  );

  console.log('Database schema initialization complete.');
  console.log(tableCheck.rows[0]);
  await pool.end();
}

main().catch((err) => {
  console.error('Database bootstrap failed:', err);
  process.exit(1);
});
