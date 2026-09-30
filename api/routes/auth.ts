import { Hono } from 'hono';
import { neonQuery } from '../db';

export const authRouter = new Hono();

authRouter.post('/login', async (c) => {
  let username: unknown;
  let password: unknown;

  try {
    const body = await c.req.json();
    username = body?.username;
    password = body?.password;
  } catch {
    return c.json({ error: 'Format permintaan tidak valid' }, 400);
  }

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return c.json({ error: 'Username atau Password yang Anda masukkan salah!' }, 401);
  }

  try {
    const sql = neonQuery();
    const result = await sql`
      SELECT id, username, full_name, created_at
      FROM bukupo.app_users
      WHERE username = ${username} AND password = ${password}
      LIMIT 1
    `;

    const rows = result as Record<string, unknown>[];
    const user = rows[0];
    if (!user) {
      return c.json({ error: 'Username atau Password yang Anda masukkan salah!' }, 401);
    }

    return c.json(user);
  } catch (err) {
    console.error('Failed to login', err);
    return c.json({ error: 'Koneksi ke database bermasalah.' }, 500);
  }
});
