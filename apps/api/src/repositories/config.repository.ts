import type { CategoryOption, UnitOption } from '@cos/shared';
import { PgBaseRepository } from './pg-base.repository';

export class CategoryRepository extends PgBaseRepository<CategoryOption> {
  constructor() {
    super('categories');
  }

  protected mapRowToEntity(row: any): CategoryOption {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      group: row.group,
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class UnitRepository extends PgBaseRepository<UnitOption> {
  constructor() {
    super('units');
  }

  protected mapRowToEntity(row: any): UnitOption {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const categoryRepository = new CategoryRepository();
export const unitRepository = new UnitRepository();
