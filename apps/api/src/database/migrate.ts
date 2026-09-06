import { pool } from './connection';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const runMigrations = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    let files: string[] = [];
    
    try {
      files = await fs.readdir(migrationsDir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log('No migrations directory found, creating it...');
        await fs.mkdir(migrationsDir, { recursive: true });
        return;
      }
      throw err;
    }

    const sqlFiles = files
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    for (const file of sqlFiles) {
      const { rows } = await client.query(
        'SELECT id FROM _migrations WHERE name = $1',
        [file]
      );

      if (rows.length === 0) {
        console.log(`Applying migration: ${file}`);
        const filePath = path.join(migrationsDir, file);
        const sql = await fs.readFile(filePath, 'utf-8');
        
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO _migrations (name) VALUES ($1)',
            [file]
          );
          await client.query('COMMIT');
          console.log(`Successfully applied ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`Failed to apply migration ${file}:`, err);
          throw err;
        }
      }
    }
    
    console.log('Database migrations are up to date.');
  } finally {
    client.release();
  }
};

import url from 'url';

// If run directly from the command line
if (import.meta.url && url.fileURLToPath(import.meta.url) === process.argv[1]) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
