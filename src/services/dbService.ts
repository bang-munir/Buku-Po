import { Customer, Product, Order, CustomerDeposit, Category } from '@/types';

export const dbService = {
  // --- CUSTOMERS ---
  async getCustomers(): Promise<Customer[]> {
    const res = await fetch('/api/customers');
    if (!res.ok) throw new Error('Gagal memuat data pelanggan');
    const data = await res.json();
    return data || [];
  },

  async upsertCustomer(customer: Customer) {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: customer.id || gen_uuid(),
        name: customer.name,
        address: customer.address || '',
        email: customer.email || '',
        type: customer.type || 'Jakarta'
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal simpan customer');
    }
  },

  async deleteCustomer(id: string) {
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal hapus customer');
    }
  },

  // --- CATEGORIES ---
  async getCategories(): Promise<Category[]> {
    const res = await fetch('/api/categories');
    if (!res.ok) throw new Error('Gagal memuat data kategori');
    const data = await res.json();
    return data || [];
  },

  async upsertCategory(category: Category) {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: category.id || gen_uuid(),
        name: category.name
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal simpan kategori');
    }
  },

  async deleteCategory(id: string) {
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal hapus kategori');
    }
  },

  // --- DEPOSITS ---
  async getDeposits(): Promise<CustomerDeposit[]> {
    const res = await fetch('/api/deposits');
    if (!res.ok) throw new Error('Gagal memuat data deposit');
    const data = await res.json();
    return (data || []).map((d: any) => ({
      ...d,
      customerId: d.customerId,
      customerName: d.customerName,
      usedAmount: d.usedAmount
    }));
  },

  async upsertDeposit(deposit: CustomerDeposit) {
    const res = await fetch('/api/deposits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: deposit.id || gen_uuid(),
        customer_id: deposit.customerId,
        customer_name: deposit.customerName,
        amount: Number(deposit.amount) || 0,
        used_amount: Number(deposit.usedAmount) || 0,
        date: deposit.date || new Date().toISOString(),
        notes: deposit.notes || ''
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal simpan deposit');
    }
  },

  async deleteDeposit(id: string) {
    const res = await fetch(`/api/deposits/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal hapus deposit');
    }
  },

  // --- PRODUCTS ---
  async getProducts(): Promise<Product[]> {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Gagal memuat data produk');
    const data = await res.json();
    return (data || []).map((p: any) => ({
      ...p,
      categoryId: p.category_id,
      costPrice: p.cost_price,
      priceJakarta: p.price_jakarta,
      priceLuarKota: p.price_luar_kota
    }));
  },

  async upsertProduct(product: Product) {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: product.id || gen_uuid(),
        name: product.name,
        description: product.description || '',
        category_id: (product.categoryId && product.categoryId.trim() !== '') ? product.categoryId : null,
        cost_price: Number(product.costPrice) || 0,
        price_jakarta: Number(product.priceJakarta) || 0,
        price_luar_kota: Number(product.priceLuarKota) || 0
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal simpan produk');
    }
  },

  async deleteProduct(id: string) {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal hapus produk');
    }
  },

  // --- ORDERS ---
  async getOrders(): Promise<Order[]> {
    const res = await fetch('/api/orders/all');
    if (!res.ok) throw new Error('Gagal memuat data PO');
    const data = await res.json();

    return (data || []).map((o: any) => ({
      id: o.id,
      invoiceNumber: o.invoice_number,
      customerId: o.customer_id,
      customerName: o.customer_name,
      customerType: o.customer_type,
      customerAddress: o.customer_address,
      orderDate: o.order_date,
      status: o.status,
      subtotal: o.subtotal,
      downPayment: o.down_payment,
      depositUsed: o.deposit_used,
      total: o.total,
      notes: o.notes,
      items: (o.items || []).map((i: any) => ({
        id: i.id,
        productId: i.product_id,
        name: i.name,
        quantity: i.quantity,
        processingQuantity: i.processing_quantity,
        shippedQuantity: i.shipped_quantity,
        unitPrice: i.unit_price,
        costPrice: i.cost_price
      })),
      payments: (o.payments || []).map((p: any) => ({
        id: p.id,
        amount: p.amount,
        date: p.date,
        note: p.note
      }))
    }));
  },

  async upsertOrder(order: Order) {
    try {
      const orderId = order.id || gen_uuid();
      console.log('Menyimpan pesanan:', order.invoiceNumber, 'ID:', orderId);

      const payload = {
        id: orderId,
        invoice_number: order.invoiceNumber,
        customer_id: order.customerId,
        customer_name: order.customerName || '',
        customer_type: order.customerType || 'Jakarta',
        customer_address: order.customerAddress || '',
        order_date: order.orderDate || new Date().toISOString(),
        status: order.status || 'PENDING',
        subtotal: Number(order.subtotal) || 0,
        down_payment: Number(order.downPayment) || 0,
        deposit_used: Number(order.depositUsed) || 0,
        total: Number(order.total) || 0,
        notes: order.notes || '',
        items: (order.items || []).map(i => ({
          id: i.id && i.id.length > 10 ? i.id : gen_uuid(),
          product_id: i.productId,
          name: i.name,
          quantity: Number(i.quantity) || 0,
          processing_quantity: Number(i.processingQuantity) || 0,
          shipped_quantity: Number(i.shippedQuantity) || 0,
          unit_price: Number(i.unitPrice) || 0,
          cost_price: Number(i.costPrice) || 0
        })),
        payments: (order.payments || []).map(p => ({
          id: p.id && p.id.length > 10 ? p.id : gen_uuid(),
          amount: Number(p.amount) || 0,
          date: p.date || new Date().toISOString(),
          note: p.note || ''
        }))
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal simpan order');
      }

      console.log('BERHASIL SIMPAN:', order.invoiceNumber);
      return true;
    } catch (error: any) {
      console.error('FATAL SAVE ERROR:', error);
      throw error;
    }
  },

  async deleteOrder(id: string) {
    const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal hapus order');
    }
  },

  formatErrorMessage(error: any, action: string): string {
    const msg = error.message || '';
    return `Gagal ${action}: ${msg}`;
  }
};

function gen_uuid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    // Fallback to manual generation
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
