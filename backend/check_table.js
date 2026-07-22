const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgres://postgres:1234567890@localhost:5432/postgres' });
p.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'active_sessions' ORDER BY ordinal_position")
  .then(r => { console.log(JSON.stringify(r.rows, null, 2)); p.end(); })
  .catch(e => { console.error(e.message); p.end(); });
