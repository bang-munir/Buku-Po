import { Hono } from 'hono';
import { neonQuery } from '../db';

export const customersRouter = new Hono();

customersRouter.get('/', async (c) => {
  try {
    const sql = neonQuery();
    const customers = await sql`
      SELECT id, name, address, email, type
      FROM bukupo.customers
      ORDER BY name
    `;
    return c.json(customers);
  } catch {
    console.error('Failed to load customers');
    return c.json({ error: 'Terjadi kesalahan saat memuat data pelanggan' }, 500);
  }
});