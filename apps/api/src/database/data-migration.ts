import { pool } from './connection';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../../data');

const idMap: Record<string, string> = {
  'user-admin': '00000000-0000-0000-0000-000000000001',
  'user-keeper': '00000000-0000-0000-0000-000000000002'
};

const mapId = (id: string | null | undefined): string | null => {
  if (!id) return null;
  return idMap[id] || id;
};

const loadJson = async (filename: string) => {
  try {
    const data = await fs.readFile(path.join(dataDir, filename), 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
};

const run = async () => {
  const client = await pool.connect();
  console.log('Starting data migration...');
  
  try {
    await client.query('BEGIN');
    
    // 1. Categories
    const categories = await loadJson('categories.json');
    for (const c of categories) {
      await client.query(
        `INSERT INTO categories (id, code, name, "group", is_active, created_by, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (code) DO NOTHING`,
        [c.id, c.code, c.name, c.group, c.isActive, c.createdBy || null, c.createdAt, c.updatedAt]
      );
    }
    console.log(`Migrated ${categories.length} categories.`);
    
    // 2. Units
    const units = await loadJson('units.json');
    for (const u of units) {
      await client.query(
        `INSERT INTO units (id, code, name, is_active, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (code) DO NOTHING`,
        [u.id, u.code, u.name, u.isActive, u.createdBy || null, u.createdAt, u.updatedAt]
      );
    }
    console.log(`Migrated ${units.length} units.`);

    // 4. Users
    const users = await loadJson('users.json');
    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, username, password_hash, full_name, role_name, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (username) DO NOTHING`,
        [mapId(u.id), u.username, u.passwordHash, u.fullName, u.roleName, u.isActive, u.createdAt, u.updatedAt]
      );
    }
    console.log(`Migrated ${users.length} users.`);

    // 5. Projects
    const projects = await loadJson('projects.json');
    for (const p of projects) {
      await client.query(
        `INSERT INTO projects (id, project_code, name, client_name, consultant_name, status, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (project_code) DO NOTHING`,
        [p.id, p.projectCode, p.name, p.clientName || null, p.consultantName || null, p.status || 'active', p.createdBy || null, p.createdAt, p.updatedAt]
      );
    }
    console.log(`Migrated ${projects.length} projects.`);

    // 6. Sites
    const sites = await loadJson('sites.json');
    for (const s of sites) {
      await client.query(
        `INSERT INTO sites (id, code, name, project_id, status, notes, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [s.id, s.code, s.name, s.projectId || null, s.status || 'active', s.notes || null, s.createdBy || null, s.createdAt, s.updatedAt]
      );
    }
    console.log(`Migrated ${sites.length} sites.`);

    // 7. Documents
    const documents = await loadJson('documents.json');
    for (const d of documents) {
      await client.query(
        `INSERT INTO documents (id, document_number, title, project_id, site_id, category, document_type, status, file_path, file_name, file_extension, file_size, revision, uploaded_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (id) DO NOTHING`,
        [d.id || crypto.randomUUID(), d.documentNumber || null, d.title, d.projectId || null, d.siteId || null, d.category || '', d.documentType || '', d.status || 'draft', d.filePath || '', d.fileName || '', d.fileExtension || '', d.fileSize || 0, d.revision || '00', d.uploadedBy || null, d.createdAt || new Date().toISOString(), d.updatedAt || new Date().toISOString()]
      );
      
      // revisions
      if (d.revisions && Array.isArray(d.revisions)) {
        for (const h of d.revisions) {
          await client.query(
            `INSERT INTO document_revisions (id, document_id, revision, file_path, file_name, file_extension, file_size, uploaded_by, notes, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (document_id, revision) DO NOTHING`,
            [h.id || crypto.randomUUID(), d.id, h.revision || '00', h.filePath || '', h.fileName || '', h.fileExtension || '', h.fileSize || 0, h.uploadedBy || null, h.notes || null, h.date || new Date().toISOString()]
          );
        }
      }
    }
    console.log(`Migrated ${documents.length} documents.`);

    // 8. Audit Logs
    const auditLogs = await loadJson('audit_logs.json');
    for (const a of auditLogs) {
      await client.query(
        `INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, old_value, new_value, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [a.id, mapId(a.userId), a.username || null, a.action, a.entity, a.entity === 'user' ? mapId(a.entityId) : a.entityId, a.oldValue ? JSON.stringify(a.oldValue) : null, a.newValue ? JSON.stringify(a.newValue) : null, a.ipAddress || null, a.timestamp || new Date().toISOString()]
      );
    }
    console.log(`Migrated ${auditLogs.length} audit logs.`);

    // Warehouses
    const warehouses = await loadJson('warehouses.json');
    for (const w of warehouses) {
      await client.query(
        `INSERT INTO warehouses (id, code, name, type, project_id, location, status, notes, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [w.id, w.code, w.name, w.type || 'central', w.projectId || null, w.location || null, w.status || 'active', w.notes || null, w.createdBy || null, w.createdAt, w.updatedAt]
      );
    }
    console.log(`Migrated ${warehouses.length} warehouses.`);

    // Items
    const items = await loadJson('items.json');
    for (const i of items) {
      await client.query(
        `INSERT INTO items (id, code, name, category, unit, brand, minimum_stock, tracking_type, notes, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [i.id, i.code, i.name, i.category || '', i.unit || '', i.brand || null, i.minimumStock || null, i.trackingType || 'none', i.notes || null, i.createdBy || null, i.createdAt, i.updatedAt]
      );
    }
    console.log(`Migrated ${items.length} items.`);

    // stock_transactions
    const stockTxs = await loadJson('stock_transactions.json');
    for (const t of stockTxs) {
      await client.query(
        `INSERT INTO stock_transactions (id, number, type, warehouse_id, destination_warehouse_id, project_id, item_id, quantity, unit_cost, reference_number, date, notes, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.number || null, t.type, t.warehouseId, t.destinationWarehouseId || null, t.projectId || null, t.itemId || null, t.quantity || null, t.unitCost || null, t.referenceNumber || null, t.date || new Date().toISOString(), t.notes || null, t.createdBy || null, t.createdAt, t.updatedAt]
      );
      if (t.items && Array.isArray(t.items)) {
         for (let idx = 0; idx < t.items.length; idx++) {
            const line = t.items[idx];
            await client.query(
              `INSERT INTO stock_transaction_lines (id, transaction_id, item_id, quantity, unit_cost, sort_order)
               VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
              [crypto.randomUUID(), t.id, line.itemId, line.quantity, line.unitCost || null, idx]
            );
         }
      }
    }
    console.log(`Migrated ${stockTxs.length} stock transactions.`);

    // Counters
    const counters = await loadJson('counters.json');
    if (Array.isArray(counters)) {
       for (const c of counters) {
         await client.query(
           `INSERT INTO counters (id, prefix, year, last_value) VALUES ($1, $2, $3, $4) ON CONFLICT (prefix, year) DO NOTHING`,
           [c.id || crypto.randomUUID(), c.prefix, c.year, c.lastValue]
         );
       }
    } else {
       // if it's an object mapped by string
       for (const key of Object.keys(counters)) {
          const parts = key.split('-');
          if (parts.length === 2) {
             await client.query(
               `INSERT INTO counters (prefix, year, last_value) VALUES ($1, $2, $3) ON CONFLICT (prefix, year) DO NOTHING`,
               [parts[0], parseInt(parts[1], 10), counters[key]]
             );
          }
       }
    }

    await client.query('COMMIT');
    console.log('Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolling back.', err);
  } finally {
    client.release();
  }
};

run().then(() => pool.end()).catch(console.error);
