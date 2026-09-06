import { pool } from '../database/connection';

/**
 * Human-readable sequential numbers per prefix per year:
 * GIN-2026-0001, GOUT-2026-0015, TRF-2026-0001, MR-2026-0007 …
 *
 * Allocated atomically in PostgreSQL with a single
 * INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING statement, which holds
 * a row lock for the (prefix, year) counter — concurrent callers can never
 * receive the same number. Format is unchanged from the legacy version.
 */
export const nextNumber = async (prefix: string, year = new Date().getFullYear()): Promise<string> => {
  const result = await pool.query(
    `INSERT INTO counters (prefix, year, last_value)
     VALUES ($1, $2, 1)
     ON CONFLICT (prefix, year) DO UPDATE SET last_value = counters.last_value + 1
     RETURNING last_value`,
    [prefix, year]
  );
  const current = Number(result.rows[0].last_value);
  return `${prefix}-${year}-${String(current).padStart(4, '0')}`;
};
