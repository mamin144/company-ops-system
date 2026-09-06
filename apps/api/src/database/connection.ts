import { Pool } from 'pg';

// The database URL must be provided explicitly (host .env / Docker Compose
// environment). A silent fallback previously pointed at a wrong port and
// masked misconfiguration, so startup now fails loudly instead.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example and configure it, ' +
      'or run through Docker Compose which supplies DATABASE_URL automatically.',
  );
}

export const pool = new Pool({
  connectionString,
  // Add basic settings for the connection pool
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Health check function to verify database connectivity.
 */
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (err) {
    console.error('Database connection error:', err);
    return false;
  }
};

/**
 * Graceful shutdown for the database pool.
 */
export const closeDatabaseConnection = async (): Promise<void> => {
  try {
    await pool.end();
    console.log('Database pool has ended');
  } catch (err) {
    console.error('Error closing database pool:', err);
  }
};
