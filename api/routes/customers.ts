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

customersRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { id, name, address, email, type } = body;
    if (!id || !name) {
      return c.json({ error: 'id dan name wajib diisi' }, 400);
    }
    const sql = neonQuery();
    await sql`
      INSERT INTO bukupo.customers (id, name, address, email, type)
      VALUES (${id}, ${name}, ${address || ''}, ${email || ''}, ${type || 'Jakarta'})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        email = EXCLUDED.email,
        type = EXCLUDED.type
    `;
    return c.json({ ok: true });
  } catch {
    console.error('Failed to upsert customer');
    return c.json({ error: 'Terjadi kesalahan saat memproses pelanggan' }, 500);
  }
});

customersRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const sql = neonQuery();
    await sql`DELETE FROM bukupo.customers WHERE id = ${id}`;
    return c.json({ ok: true });
  } catch {
    console.error('Failed to delete customer');
    return c.json({ error: 'Terjadi kesalahan saat memproses pelanggan' }, 500);
  }
});
