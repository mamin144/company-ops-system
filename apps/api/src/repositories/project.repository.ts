import type { Project } from '@cos/shared';
import { PgBaseRepository } from './pg-base.repository';
import { pool } from '../database/connection';
import { createId } from '../shared/id';
import { nowIso } from '../shared/time';

export class ProjectRepository extends PgBaseRepository<Project> {
  constructor() {
    super('projects');
  }

  protected mapRowToEntity(row: any): Project {
    return {
      id: row.id,
      projectCode: row.project_code,
      projectName: row.project_name,
      client: row.client,
      owner: row.owner ?? '',
      mainContractor: row.main_contractor,
      siteLocation: row.site_location,
      region: row.region,
      contractNumber: row.contract_number,
      startDate: row.start_date ? new Date(row.start_date).toISOString() : undefined,
      endDate: row.end_date ? new Date(row.end_date).toISOString() : undefined,
      status: row.status,
      role: row.role,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async create(input: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const id = createId();
    const now = nowIso();
    await pool.query(
      `INSERT INTO projects (id, project_code, project_name, client, owner, main_contractor, site_location, region, contract_number, start_date, end_date, status, role, notes, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [id, input.projectCode, input.projectName, input.client ?? '', input.owner ?? '', input.mainContractor ?? '', input.siteLocation ?? '', input.region || null, input.contractNumber ?? '', input.startDate || null, input.endDate || null, input.status, input.role || null, input.notes || null, input.createdBy || null, now, now]
    );
    return { ...input, id, createdAt: now, updatedAt: now };
  }

  async update(id: string, input: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<Project | undefined> {
    const now = nowIso();
    const setClause: string[] = [];
    const params: any[] = [];
    
    if (input.projectCode !== undefined) { params.push(input.projectCode); setClause.push(`project_code = $${params.length}`); }
    if (input.projectName !== undefined) { params.push(input.projectName); setClause.push(`project_name = $${params.length}`); }
    if (input.client !== undefined) { params.push(input.client); setClause.push(`client = $${params.length}`); }
    if (input.owner !== undefined) { params.push(input.owner); setClause.push(`owner = $${params.length}`); }
    if (input.mainContractor !== undefined) { params.push(input.mainContractor); setClause.push(`main_contractor = $${params.length}`); }
    if (input.siteLocation !== undefined) { params.push(input.siteLocation); setClause.push(`site_location = $${params.length}`); }
    if (input.region !== undefined) { params.push(input.region); setClause.push(`region = $${params.length}`); }
    if (input.contractNumber !== undefined) { params.push(input.contractNumber); setClause.push(`contract_number = $${params.length}`); }
    if (input.startDate !== undefined) { params.push(input.startDate || null); setClause.push(`start_date = $${params.length}`); }
    if (input.endDate !== undefined) { params.push(input.endDate || null); setClause.push(`end_date = $${params.length}`); }
    if (input.status !== undefined) { params.push(input.status); setClause.push(`status = $${params.length}`); }
    if (input.role !== undefined) { params.push(input.role); setClause.push(`role = $${params.length}`); }
    if (input.notes !== undefined) { params.push(input.notes || null); setClause.push(`notes = $${params.length}`); }
    if (input.createdBy !== undefined) { params.push(input.createdBy); setClause.push(`created_by = $${params.length}`); }
    
    if (setClause.length === 0) return this.findById(id);
    
    params.push(now);
    setClause.push(`updated_at = $${params.length}`);
    params.push(id);
    
    const result = await pool.query(
      `UPDATE projects SET ${setClause.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    
    if (result.rows.length === 0) return undefined;
    return this.mapRowToEntity(result.rows[0]);
  }
}

export const projectRepository = new ProjectRepository();
