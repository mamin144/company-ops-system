import type { User } from '@cos/shared';
import { PgBaseRepository } from './pg-base.repository';
import { pool } from '../database/connection';
import { createId } from '../shared/id';
import { nowIso } from '../shared/time';

export class UserRepository extends PgBaseRepository<User> {
  constructor() {
    super('users');
  }

  protected mapRowToEntity(row: any): User {
    return {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      passwordHash: row.password_hash,
      roleName: row.role_name,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async create(input: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const id = createId();
    const now = nowIso();
    await pool.query(
      `INSERT INTO users (id, username, full_name, password_hash, role_name, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, input.username, input.fullName, input.passwordHash, input.roleName, input.isActive, now, now]
    );
    return { ...input, id, createdAt: now, updatedAt: now };
  }

  async update(id: string, input: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | undefined> {
    const now = nowIso();
    const setClause: string[] = [];
    const params: any[] = [];
    
    if (input.username !== undefined) { params.push(input.username); setClause.push(`username = $${params.length}`); }
    if (input.fullName !== undefined) { params.push(input.fullName); setClause.push(`full_name = $${params.length}`); }
    if (input.passwordHash !== undefined) { params.push(input.passwordHash); setClause.push(`password_hash = $${params.length}`); }
    if (input.roleName !== undefined) { params.push(input.roleName); setClause.push(`role_name = $${params.length}`); }
    if (input.isActive !== undefined) { params.push(input.isActive); setClause.push(`is_active = $${params.length}`); }
    
    if (setClause.length === 0) return this.findById(id);
    
    params.push(now);
    setClause.push(`updated_at = $${params.length}`);
    params.push(id);
    
    const result = await pool.query(
      `UPDATE users SET ${setClause.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }
}

export const userRepository = new UserRepository();
