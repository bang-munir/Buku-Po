import { Hono } from 'hono';
import { neonQuery } from '../db';

export const ordersRouter = new Hono();

ordersRouter.get('/all', async (c) => {
  try {
    const sql = neonQuery();
    const orders = await sql`
      SELECT id, invoice_number, customer_id, customer_name, customer_type, customer_address,
             order_date, status, subtotal, down_payment, deposit_used, total, notes, created_at
      FROM bukupo.orders
      ORDER BY order_date DESC, created_at DESC
    `;
    const allItems = await sql`
      SELECT id, order_id, product_id, name, quantity, processing_quantity,
             shipped_quantity, unit_price, cost_price
      FROM bukupo.order_items
    `;
    const allPayments = await sql`
      SELECT id, order_id, amount, date, note
      FROM bukupo.payments
    `;
    const itemsByOrder = new Map<string, any[]>();
    for (const i of allItems) {
      const oid = i.order_id;
      if (!itemsByOrder.has(oid)) itemsByOrder.set(oid, []);
      itemsByOrder.get(oid)!.push(i);
    }
    const paymentsByOrder = new Map<string, any[]>();
    for (const p of allPayments) {
      const oid = p.order_id;
      if (!paymentsByOrder.has(oid)) paymentsByOrder.set(oid, []);
      paymentsByOrder.get(oid)!.push(p);
    }
    const result = orders.map((o: any) => ({
      ...o,
      items: itemsByOrder.get(o.id) || [],
      payments: paymentsByOrder.get(o.id) || []
    }));
    return c.json(result);
  } catch {
    console.error('Failed to load all orders');
    return c.json({ error: 'Terjadi kesalahan saat memuat data PO' }, 500);
  }
});

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
    const payments = await sql`
      SELECT id, order_id, amount, date, note
      FROM bukupo.payments
      WHERE order_id = ${id}
      ORDER BY date
    `;
    return c.json({ ...order, items, payments });
  } catch {
    console.error('Failed to load order detail');
    return c.json({ error: 'Terjadi kesalahan saat memuat detail PO' }, 500);
  }
});

ordersRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const sql = neonQuery();

    const orderId = body.id;
    if (!orderId) {
      return c.json({ error: 'id wajib diisi' }, 400);
    }

    const queries: any[] = [];

    queries.push(sql`
      INSERT INTO bukupo.orders (id, invoice_number, customer_id, customer_name, customer_type, customer_address,
        order_date, status, subtotal, down_payment, deposit_used, total, notes)
      VALUES (${orderId}, ${body.invoice_number || ''}, ${body.customer_id || ''}, ${body.customer_name || ''},
        ${body.customer_type || 'Jakarta'}, ${body.customer_address || ''},
        ${body.order_date || new Date().toISOString()}, ${body.status || 'PENDING'},
        ${Number(body.subtotal) || 0}, ${Number(body.down_payment) || 0},
        ${Number(body.deposit_used) || 0}, ${Number(body.total) || 0}, ${body.notes || ''})
      ON CONFLICT (id) DO UPDATE SET
        invoice_number = EXCLUDED.invoice_number,
        customer_id = EXCLUDED.customer_id,
        customer_name = EXCLUDED.customer_name,
        customer_type = EXCLUDED.customer_type,
        customer_address = EXCLUDED.customer_address,
        order_date = EXCLUDED.order_date,
        status = EXCLUDED.status,
        subtotal = EXCLUDED.subtotal,
        down_payment = EXCLUDED.down_payment,
        deposit_used = EXCLUDED.deposit_used,
        total = EXCLUDED.total,
        notes = EXCLUDED.notes
    `);

    queries.push(sql`DELETE FROM bukupo.order_items WHERE order_id = ${orderId}`);

    if (body.items && body.items.length > 0) {
      for (const item of body.items) {
        const itemId = item.id && item.id.length > 10 ? item.id : crypto.randomUUID();
        queries.push(sql`
          INSERT INTO bukupo.order_items (id, order_id, product_id, name, quantity, processing_quantity, shipped_quantity, unit_price, cost_price)
          VALUES (${itemId}, ${orderId}, ${item.product_id || ''}, ${item.name || ''},
            ${Number(item.quantity) || 0}, ${Number(item.processing_quantity) || 0},
            ${Number(item.shipped_quantity) || 0}, ${Number(item.unit_price) || 0},
            ${Number(item.cost_price) || 0})
        `);
      }
    }

    queries.push(sql`DELETE FROM bukupo.payments WHERE order_id = ${orderId}`);

    if (body.payments && body.payments.length > 0) {
      for (const payment of body.payments) {
        const paymentId = payment.id && payment.id.length > 10 ? payment.id : crypto.randomUUID();
        queries.push(sql`
          INSERT INTO bukupo.payments (id, order_id, amount, date, note)
          VALUES (${paymentId}, ${orderId}, ${Number(payment.amount) || 0},
            ${payment.date || new Date().toISOString()}, ${payment.note || ''})
        `);
      }
    }

    await sql.transaction(queries);

    return c.json({ ok: true });
  } catch {
    console.error('Failed to upsert order');
    return c.json({ error: 'Terjadi kesalahan saat memproses pesanan' }, 500);
  }
});

ordersRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const sql = neonQuery();
    await sql.transaction([
      sql`DELETE FROM bukupo.payments WHERE order_id = ${id}`,
      sql`DELETE FROM bukupo.order_items WHERE order_id = ${id}`,
      sql`DELETE FROM bukupo.orders WHERE id = ${id}`
    ]);
    return c.json({ ok: true });
  } catch {
    console.error('Failed to delete order');
    return c.json({ error: 'Terjadi kesalahan saat memproses pesanan' }, 500);
  }
});
