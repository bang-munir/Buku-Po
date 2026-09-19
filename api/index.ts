import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { customersRouter } from './routes/customers';
import { ordersRouter } from './routes/orders';
import { categoriesRouter } from './routes/categories';
import { productsRouter } from './routes/products';
import { depositsRouter } from './routes/deposits';
import { paymentsRouter } from './routes/payments';

export const config = { runtime: 'edge' };

const app = new Hono().basePath('/api');

app.get('/health', (c) => {
  return c.json({ ok: true });
});

app.route('/customers', customersRouter);
app.route('/orders', ordersRouter);
app.route('/categories', categoriesRouter);
app.route('/products', productsRouter);
app.route('/deposits', depositsRouter);
app.route('/payments', paymentsRouter);

export default handle(app);
