import { Hono } from 'hono';
import { neonQuery } from '../db';

export const productsRouter = new Hono();

productsRouter.get('/', async (c) => {
  try {
    const sql = neonQuery();
    const products = await sql`
      SELECT id, name, description, category_id, cost_price, price_jakarta, price_luar_kota
      FROM bukupo.products
      ORDER BY name
    `;
    return c.json(products);
  } catch {
    console.error('Failed to load products');
    return c.json({ error: 'Terjadi kesalahan saat memuat data produk' }, 500);
  }
});

productsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { id, name, description, category_id, cost_price, price_jakarta, price_luar_kota } = body;
    if (!id || !name) {
      return c.json({ error: 'id dan name wajib diisi' }, 400);
    }
    const sql = neonQuery();
    await sql`
      INSERT INTO bukupo.products (id, name, description, category_id, cost_price, price_jakarta, price_luar_kota)
      VALUES (${id}, ${name}, ${description || ''}, ${category_id || null}, ${Number(cost_price) || 0}, ${Number(price_jakarta) || 0}, ${Number(price_luar_kota) || 0})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        category_id = EXCLUDED.category_id,
        cost_price = EXCLUDED.cost_price,
        price_jakarta = EXCLUDED.price_jakarta,
        price_luar_kota = EXCLUDED.price_luar_kota
    `;
    return c.json({ ok: true });
  } catch {
    console.error('Failed to upsert product');
    return c.json({ error: 'Terjadi kesalahan saat memproses produk' }, 500);
  }
});

productsRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const sql = neonQuery();
    await sql`DELETE FROM bukupo.products WHERE id = ${id}`;
    return c.json({ ok: true });
  } catch {
    console.error('Failed to delete product');
    return c.json({ error: 'Terjadi kesalahan saat memproses produk' }, 500);
  }
});
