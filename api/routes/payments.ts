import { Hono } from 'hono';
import { neonQuery } from '../db';

export const paymentsRouter = new Hono();

paymentsRouter.get('/', async (c) => {
  try {
    const sql = neonQuery();
    const payments = await sql`
      SELECT id, order_id, amount, date, note
      FROM bukupo.payments
      ORDER BY date DESC
    `;
    return c.json(payments);
  } catch {
    console.error('Failed to load payments');
    return c.json({ error: 'Terjadi kesalahan saat memuat data pembayaran' }, 500);
  }
});
