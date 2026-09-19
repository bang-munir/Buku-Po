import { Hono } from 'hono';
import { neonQuery } from '../db';

export const depositsRouter = new Hono();

depositsRouter.get('/', async (c) => {
  try {
    const sql = neonQuery();
    const deposits = await sql`
      SELECT id, customer_id, customer_name, amount, used_amount, date, notes
      FROM bukupo.deposits
      ORDER BY date DESC
    `;
    const mapped = deposits.map((d: any) => ({
      id: d.id,
      customerId: d.customer_id,
      customerName: d.customer_name,
      amount: d.amount,
      usedAmount: d.used_amount,
      date: d.date,
      notes: d.notes
    }));
    return c.json(mapped);
  } catch {
    console.error('Failed to load deposits');
    return c.json({ error: 'Terjadi kesalahan saat memuat data deposit' }, 500);
  }
});

depositsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { id, customer_id, customer_name, amount, used_amount, date, notes } = body;
    if (!id) {
      return c.json({ error: 'id wajib diisi' }, 400);
    }
    const sql = neonQuery();
    await sql`
      INSERT INTO bukupo.deposits (id, customer_id, customer_name, amount, used_amount, date, notes)
      VALUES (${id}, ${customer_id || ''}, ${customer_name || ''}, ${Number(amount) || 0}, ${Number(used_amount) || 0}, ${date || new Date().toISOString()}, ${notes || ''})
      ON CONFLICT (id) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        customer_name = EXCLUDED.customer_name,
        amount = EXCLUDED.amount,
        used_amount = EXCLUDED.used_amount,
        date = EXCLUDED.date,
        notes = EXCLUDED.notes
    `;
    return c.json({ ok: true });
  } catch {
    console.error('Failed to upsert deposit');
    return c.json({ error: 'Terjadi kesalahan saat memproses deposit' }, 500);
  }
});

depositsRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const sql = neonQuery();
    await sql`DELETE FROM bukupo.deposits WHERE id = ${id}`;
    return c.json({ ok: true });
  } catch {
    console.error('Failed to delete deposit');
    return c.json({ error: 'Terjadi kesalahan saat memproses deposit' }, 500);
  }
});
