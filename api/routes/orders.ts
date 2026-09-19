import { Hono } from 'hono';
import { neonQuery } from '../db';

export const ordersRouter = new Hono();

ordersRouter.get('/', async (c) => {
  try {
    const sql = neonQuery();
    const orders = await sql`
      SELECT id, invoice_number, customer_id, customer_name, customer_type, customer_address,
             order_date, status, subtotal, down_payment, deposit_used, total, notes, created_at
      FROM bukupo.orders
      ORDER BY order_date DESC, created_at DESC
    `;
    return c.json(orders);
  } catch {
    console.error('Failed to load orders');
    return c.json({ error: 'Terjadi kesalahan saat memuat data PO' }, 500);
  }
});

ordersRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const sql = neonQuery();
    const orderRows = await sql`
      SELECT id, invoice_number, customer_id, customer_name, customer_type, customer_address,
             order_date, status, subtotal, down_payment, deposit_used, total, notes, created_at
      FROM bukupo.orders
      WHERE id = ${id}
      LIMIT 1
    `;
    if (orderRows.length === 0) {
      return c.json({ error: 'PO tidak ditemukan' }, 404);
    }
    const order = orderRows[0];
    const items = await sql`
      SELECT id, order_id, product_id, name, quantity, processing_quantity,
             shipped_quantity, unit_price, cost_price
      FROM bukupo.order_items
      WHERE order_id = ${id}
      ORDER BY id
    `;
    return c.json({ ...order, items });
  } catch {
    console.error('Failed to load order detail');
    return c.json({ error: 'Terjadi kesalahan saat memuat detail PO' }, 500);
  }
});
