import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { customersRouter } from './routes/customers';
import { ordersRouter } from './routes/orders';

export const config = { runtime: 'edge' };

const app = new Hono().basePath('/api');

app.get('/health', (c) => {
  return c.json({ ok: true });
});

app.route('/customers', customersRouter);
app.route('/orders', ordersRouter);

export default handle(app);
