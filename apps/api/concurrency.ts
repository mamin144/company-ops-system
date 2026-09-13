import { Pool } from 'pg';
import { stockService } from './src/services/stock.service';
import { itemRepository } from './src/repositories/item.repository';
import { warehouseRepository } from './src/repositories/warehouse.repository';
import { stockTransactionRepository } from './src/repositories/stock-transaction.repository';
import { createStockTransactionInternal } from './src/modules/stock/stock.factory';

const pool = new Pool({ connectionString: 'postgres://postgres:123@localhost:4000/cos_db' });

async function runConcurrencyTest() {
  console.log('Starting concurrency test...');
  
  const whId = '11111111-1111-1111-1111-111111111111';
  const itemId = '22222222-2222-2222-2222-222222222222';
  await pool.query(`INSERT INTO warehouses (id, name, code, location, type, status) VALUES ($1, 'W', 'W', 'L', 'central', 'active') ON CONFLICT DO NOTHING`, [whId]);
  await pool.query(`INSERT INTO items (id, name, code, unit, category) VALUES ($1, 'I', 'I', 'pcs', 'raw') ON CONFLICT DO NOTHING`, [itemId]);
  
  const wh = { id: whId };
  const item = { id: itemId };
  const dummyUser = { username: 'test-admin', id: 'u1', role: 'admin', permissions: ['warehouse.stock_out', 'warehouse.stock_in'] };

  // 2. Add initial stock of 10
  await createStockTransactionInternal({
    type: 'IN',
    warehouseId: wh.id,
    date: new Date().toISOString(),
    items: [{ itemId: item.id, quantity: 10 }]
  }, dummyUser as any);

  console.log(`Initial stock: ${await stockService.availableQty(item.id, wh.id)}`);

  // 3. Simultaneously request OUT 7 twice
  console.log('Dispatching two OUT 7 requests concurrently...');
  const outReq = {
    type: 'OUT' as const,
    warehouseId: wh.id,
    date: new Date().toISOString(),
    items: [{ itemId: item.id, quantity: 7 }]
  };

  try {
    await Promise.all([
      createStockTransactionInternal(outReq, dummyUser as any),
      createStockTransactionInternal(outReq, dummyUser as any)
    ]);
  } catch (e) {
    console.log('Caught expected error from one request:', (e as Error).message);
  }

  // 4. Check final stock
  const finalStock = await stockService.availableQty(item.id, wh.id);
  console.log(`Final stock: ${finalStock}`);
  if (finalStock < 0) {
    console.error('❌ RACE CONDITION CONFIRMED: Stock is negative!');
  } else {
    console.log('✅ Stock is safe.');
  }

  // Cleanup
  console.log('Cleaning up...');
  await pool.query('DELETE FROM stock_transactions WHERE warehouse_id = $1', [wh.id]);
  await pool.query('DELETE FROM items WHERE id = $1', [item.id]);
  await pool.query('DELETE FROM warehouses WHERE id = $1', [wh.id]);
  
  pool.end();
}

runConcurrencyTest().catch(console.error);
