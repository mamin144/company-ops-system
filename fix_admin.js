const { Pool } = require('C:/Users/PC-01/Documents/Default Project/company-ops-system/node_modules/pg');
const bcrypt = require('C:/Users/PC-01/Documents/Default Project/company-ops-system/node_modules/bcryptjs');
const pool = new Pool({ connectionString: 'postgresql://cos:cos-local-dev-password@localhost:5432/cos_db' });
(async () => {
  const hash = bcrypt.hashSync('admin123', 10);
  await pool.query('DELETE FROM users');
  await pool.query(
    "INSERT INTO users (username, full_name, password_hash, role_name, is_active) VALUES ('admin', 'مدير النظام', $1, 'admin', true)",
    [hash]
  );
  const r = await pool.query('SELECT password_hash FROM users');
  console.log('Hash stored:', r.rows[0].password_hash);
  const ok = bcrypt.compareSync('admin123', r.rows[0].password_hash);
  console.log('Password verify:', ok);
  await pool.end();
})();
