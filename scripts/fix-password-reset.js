const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Fix 1: Add usage_token column to password_reset_tokens table
const fixDatabase = async () => {
  const pool = new Pool({
    connectionString: 'postgres://postgres@127.0.0.1:5433/cos_stage2_populated_dryrun?password=Admin@123'
  });
  
  try {
    // Add usage_token column
    await pool.query('ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS usage_token VARCHAR(255)');
    console.log('✓ Added usage_token column');
    
    // Verify the schema
    const schema = await pool.query(\`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'password_reset_tokens' ORDER BY ordinal_position\`);
    console.log('✓ Updated schema:', schema.rows);
  } catch (err) {
    console.error('✗ Database fix error:', err.message);
  } finally {
    await pool.end();
  }
};

fixDatabase();