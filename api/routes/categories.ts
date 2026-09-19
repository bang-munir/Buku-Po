import { Hono } from 'hono';
import { neonQuery } from '../db';

export const categoriesRouter = new Hono();

categoriesRouter.get('/', async (c) => {
  try {
    const sql = neonQuery();
    const categories = await sql`
      SELECT id, name
      FROM bukupo.categories
      ORDER BY name
    `;
    return c.json(categories);
  } catch {
    console.error('Failed to load categories');
    return c.json({ error: 'Terjadi kesalahan saat memuat data kategori' }, 500);
  }
});

categoriesRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { id, name } = body;
    if (!id || !name) {
      return c.json({ error: 'id dan name wajib diisi' }, 400);
    }
    const sql = neonQuery();
    await sql`
      INSERT INTO bukupo.categories (id, name)
      VALUES (${id}, ${name})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `;
    return c.json({ ok: true });
  } catch {
    console.error('Failed to upsert category');
    return c.json({ error: 'Terjadi kesalahan saat memproses kategori' }, 500);
  }
});

categoriesRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const sql = neonQuery();
    await sql`DELETE FROM bukupo.categories WHERE id = ${id}`;
    return c.json({ ok: true });
  } catch {
    console.error('Failed to delete category');
    return c.json({ error: 'Terjadi kesalahan saat memproses kategori' }, 500);
  }
});
