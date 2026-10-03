import { Hono } from 'hono';
import { neonQuery } from '../db';

export const ordersRouter = new Hono();

const PO_NUMBER_MIN = 1000;
const PO_NUMBER_MAX = 9999;
const PO_NUMBER_ATTEMPTS = 10;

function generatePoNumber(): string {
  const span = PO_NUMBER_MAX - PO_NUMBER_MIN + 1;
  const pick = new Uint32Array(1);
  crypto.getRandomValues(pick);
  return `PO-${PO_NUMBER_MIN + (pick[0] % span)}`;
}

function pgErrorField(err: unknown, field: 'code' | 'constraint'): string | undefined {
  const e = err as Record<string, any>;
  return (
    e?.[field] ||
    e?.cause?.[field] ||
    e?.sourceError?.[field] ||
    (field === 'constraint'
      ? /unique constraint "([^"]+)"/i.exec(String(e?.message || ''))?.[1]
      : undefined)
  );
}

function isUniqueViolation(err: unknown): boolean {
  if (pgErrorField(err, 'code') === '23505') return true;
  return /duplicate key value|\b23505\b/.test(String((err as any)?.message || ''));
}

function isNonInvoiceConflict(err: unknown): boolean {
  const constraint = pgErrorField(err, 'constraint');
  return Boolean(constraint) && !constraint!.includes('invoice_number');
}

type DocRow = Record<string, any>;

function byCreatedAtAsc(a: DocRow, b: DocRow): number {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function toNotaDocument(n: DocRow) {
  return {
    id: n.id,
    nomor: n.nomor,
    surat_jalan_id: n.surat_jalan_id ?? null,
    surat_jalan_nomor: n.surat_jalan_nomor,
    tanggal: n.tanggal,
    created_at: n.created_at
  };
}

/**
 * Menyusun tree PO -> SJ -> NT dari dua batch row (bukan N+1 per order).
 *
 * Relasi utama: s.order_id = o.id. Fallback defensif hanya untuk SJ yang
 * order_id IS NULL tapi invoice_number cocok dengan PO. Setiap SJ dipetakan
 * ke satu PO saja (yang lewat order_id menang) sehingga tidak mungkin dobel.
 *
 * SJ yang keduanya tidak cocok (orphan/manual) tidak masuk PO mana pun.
 * NT dengan surat_jalan_id NULL (legacy) dibuang: tree resmi hanya memakai
 * relasi nota.surat_jalan_id, tanpa heuristik nomor.
 */
export function groupOrderDocuments(sjRows: DocRow[], ntRows: DocRow[]): Map<string, any> {
  const notaBySj = new Map<string, DocRow[]>();
  const notaSeen = new Set<string>();
  for (const n of [...ntRows].sort(byCreatedAtAsc)) {
    if (!n.surat_jalan_id || notaSeen.has(n.id)) continue;
    notaSeen.add(n.id);
    if (!notaBySj.has(n.surat_jalan_id)) notaBySj.set(n.surat_jalan_id, []);
    notaBySj.get(n.surat_jalan_id)!.push(toNotaDocument(n));
  }

  const matchBySj = new Map<string, { orderId: string; primary: boolean }>();
  for (const s of sjRows) {
    const orderId = s.matched_order_id;
    if (!orderId) continue;
    const primary = Boolean(s.order_id) && s.order_id === orderId;
    const prev = matchBySj.get(s.id);
    if (!prev || (primary && !prev.primary)) matchBySj.set(s.id, { orderId, primary });
  }

  const sjDocById = new Map<string, DocRow>();
  for (const s of sjRows) {
    if (!matchBySj.has(s.id) || sjDocById.has(s.id)) continue;
    sjDocById.set(s.id, {
      id: s.id,
      nomor: s.nomor,
      tanggal: s.tanggal,
      created_at: s.created_at,
      order_id: s.order_id ?? null,
      invoice_number: s.invoice_number ?? null,
      nota: notaBySj.get(s.id) || []
    });
  }

  const docsByOrder = new Map<string, any>();
  for (const [sjId, match] of matchBySj) {
    const doc = sjDocById.get(sjId);
    if (!doc) continue;
    if (!docsByOrder.has(match.orderId)) docsByOrder.set(match.orderId, { surat_jalan: [] });
    docsByOrder.get(match.orderId).surat_jalan.push(doc);
  }
  for (const entry of docsByOrder.values()) entry.surat_jalan.sort(byCreatedAtAsc);
  return docsByOrder;
}

/**
 * Dua query batch untuk seluruh PO (order, items, payments sudah diambil
 * terpisah di handler). Tidak ada query per order.
 */
async function loadOrderDocuments(): Promise<Map<string, any>> {
  const sql = neonQuery();
  const sjRows = (await sql`
    SELECT s.id, s.nomor, s.tanggal, s.created_at, s.order_id, s.invoice_number,
           o.id AS matched_order_id
    FROM public.surat_jalan s
    JOIN bukupo.orders o
      ON (s.order_id IS NOT NULL AND s.order_id = o.id)
      OR (s.order_id IS NULL AND s.invoice_number IS NOT NULL AND s.invoice_number = o.invoice_number)
  `) as DocRow[];
  const ntRows = (await sql`
    SELECT id, nomor, surat_jalan_id, surat_jalan_nomor, tanggal, created_at
    FROM public.nota
    WHERE surat_jalan_id IS NOT NULL
  `) as DocRow[];
  return groupOrderDocuments(sjRows, ntRows);
}

ordersRouter.get('/all', async (c) => {
  try {
    const sql = neonQuery();
    const orders = (await sql`
      SELECT id, invoice_number, customer_id, customer_name, customer_type, customer_address,
             order_date, status, subtotal, down_payment, deposit_used, total, notes, created_at
      FROM bukupo.orders
      ORDER BY order_date DESC, created_at DESC
    `) as Record<string, any>[];
    const allItems = (await sql`
      SELECT id, order_id, product_id, name, quantity, processing_quantity,
             shipped_quantity, unit_price, cost_price
      FROM bukupo.order_items
    `) as Record<string, any>[];
    const allPayments = (await sql`
      SELECT id, order_id, amount, date, note
      FROM bukupo.payments
    `) as Record<string, any>[];

    // Gagal memuat dokumen tidak boleh menghapus data PO yang sudah berhasil
    // dibaca; order tetap dikirim dengan documents.surat_jalan = [].
    let documentsByOrder = new Map<string, any>();
    try {
      documentsByOrder = await loadOrderDocuments();
    } catch (err) {
      console.error('Failed to load surat_jalan/nota documents', err);
    }

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
      payments: paymentsByOrder.get(o.id) || [],
      documents: documentsByOrder.get(o.id) || { surat_jalan: [] }
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
    const orderRows = (await sql`
      SELECT id, invoice_number, customer_id, customer_name, customer_type, customer_address,
             order_date, status, subtotal, down_payment, deposit_used, total, notes, created_at
      FROM bukupo.orders
      WHERE id = ${id}
      LIMIT 1
    `) as Record<string, any>[];
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

    const providedNumber = typeof body.invoice_number === 'string' ? body.invoice_number.trim() : '';
    let invoiceNumber = providedNumber;
    let generated = false;

    const existing = (await sql`
      SELECT invoice_number FROM bukupo.orders WHERE id = ${orderId} LIMIT 1
    `) as Record<string, any>[];

    if (existing.length > 0) {
      invoiceNumber = existing[0].invoice_number;
    } else if (!invoiceNumber) {
      generated = true;
    }

    const buildQueries = (number: string) => {
      const queries: any[] = [];

      queries.push(sql`
      INSERT INTO bukupo.orders (id, invoice_number, customer_id, customer_name, customer_type, customer_address,
        order_date, status, subtotal, down_payment, deposit_used, total, notes)
      VALUES (${orderId}, ${number}, ${body.customer_id || ''}, ${body.customer_name || ''},
        ${body.customer_type || 'Jakarta'}, ${body.customer_address || ''},
        ${body.order_date || new Date().toISOString()}, ${body.status || 'PENDING'},
        ${Number(body.subtotal) || 0}, ${Number(body.down_payment) || 0},
        ${Number(body.deposit_used) || 0}, ${Number(body.total) || 0}, ${body.notes || ''})
      ON CONFLICT (id) DO UPDATE SET
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

      return queries;
    };

    for (let attempt = 1; attempt <= PO_NUMBER_ATTEMPTS; attempt++) {
      const number = generated ? generatePoNumber() : invoiceNumber;

      try {
        await sql.transaction(buildQueries(number));
        const saved = (await sql`
          SELECT invoice_number FROM bukupo.orders WHERE id = ${orderId} LIMIT 1
        `) as Record<string, any>[];
        const authoritative = saved.length > 0 && saved[0].invoice_number ? saved[0].invoice_number : number;
        return c.json({ ok: true, invoice_number: authoritative });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        if (isNonInvoiceConflict(err)) throw err;
        if (!generated) {
          return c.json({ error: `Nomor ${number} sudah dipakai. Gunakan nomor lain.` }, 409);
        }
        if (attempt >= PO_NUMBER_ATTEMPTS) {
          console.error('Gagal membuat nomor PO baru setelah', PO_NUMBER_ATTEMPTS, 'percobaan');
          return c.json({ error: 'Gagal membuat nomor PO baru: 10 nomor kembar beruntun. Coba lagi.' }, 500);
        }
      }
    }

    return c.json({ error: 'Gagal membuat nomor PO baru' }, 500);
  } catch (err) {
    console.error('Failed to upsert order', err);
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
