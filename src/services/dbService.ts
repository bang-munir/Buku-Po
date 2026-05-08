import { supabase } from '@/lib/supabase';
import { Customer, Product, Order, CustomerDeposit, Category } from '@/types';

export const dbService = {
  // --- CUSTOMERS ---
  async getCustomers(): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  },

  async upsertCustomer(customer: Customer) {
    const { error } = await supabase
      .from('customers')
      .upsert({
        id: customer.id || gen_uuid(),
        name: customer.name,
        address: customer.address || '',
        email: customer.email || '',
        type: customer.type || 'Jakarta'
      });
    
    if (error) {
      console.error('Error saving customer:', error);
      throw error;
    }
  },

  async deleteCustomer(id: string) {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // --- CATEGORIES ---
  async getCategories(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  },

  async upsertCategory(category: Category) {
    const categoryId = category.id || gen_uuid();
    const { error } = await supabase
      .from('categories')
      .upsert({
        id: categoryId,
        name: category.name
      });
    
    if (error) {
      console.error('Error saving category:', error);
      throw error;
    }
  },

  async deleteCategory(id: string) {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  },

  // --- DEPOSITS ---
  async getDeposits(): Promise<CustomerDeposit[]> {
    const { data, error } = await supabase
      .from('deposits')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) {
      console.error('Error fetching deposits:', error);
      throw error;
    }
    
    return (data || []).map(d => ({
      ...d,
      customerId: d.customer_id,
      customerName: d.customer_name,
      usedAmount: d.used_amount
    }));
  },

  async upsertDeposit(deposit: CustomerDeposit) {
    const depositId = deposit.id || gen_uuid();
    const { error } = await supabase
      .from('deposits')
      .upsert({
        id: depositId,
        customer_id: deposit.customerId,
        customer_name: deposit.customerName,
        amount: Number(deposit.amount) || 0,
        used_amount: Number(deposit.usedAmount) || 0,
        date: deposit.date || new Date().toISOString(),
        notes: deposit.notes || ''
      });
    
    if (error) {
      console.error('Error saving deposit:', error);
      throw error;
    }
  },

  async deleteDeposit(id: string) {
    const { error } = await supabase
      .from('deposits')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // --- PRODUCTS ---
  async getProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    return (data || []).map(p => ({
      ...p,
      categoryId: p.category_id,
      costPrice: p.cost_price,
      priceJakarta: p.price_jakarta,
      priceLuarKota: p.price_luar_kota
    }));
  },

  async upsertProduct(product: Product) {
    const productId = product.id || gen_uuid();
    const payload = {
      id: productId,
      name: product.name,
      description: product.description || '',
      category_id: (product.categoryId && product.categoryId.trim() !== '') ? product.categoryId : null,
      cost_price: Number(product.costPrice) || 0,
      price_jakarta: Number(product.priceJakarta) || 0,
      price_luar_kota: Number(product.priceLuarKota) || 0
    };

    const { error } = await supabase
      .from('products')
      .upsert(payload);
    
    if (error) {
      console.error('Error saving product:', error);
      throw error;
    }
  },

  async deleteProduct(id: string) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // --- ORDERS ---
  async getOrders(): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*), payments(*)')
      .order('order_date', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(o => ({
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
      items: (o.order_items || []).map((i: any) => ({
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

      // 1. Bersihkan data Header Order
      const orderPayload = {
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
        notes: order.notes || ''
      };

      const { error: orderError } = await supabase
        .from('orders')
        .upsert(orderPayload);
      
      if (orderError) {
        console.error('DATABASE ERROR [Orders]:', orderError);
        throw new Error(`Gagal simpan header order: ${orderError.message}`);
      }

      // 2. Refresh Order Items (Hapus yang lama, masukkan yang baru)
      const { error: deleteItemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);
      
      if (deleteItemsError) console.warn('Peringatan: Gagal hapus item lama:', deleteItemsError);

      if (order.items && order.items.length > 0) {
        const itemsToSave = order.items.map(i => ({
          id: i.id && i.id.length > 10 ? i.id : gen_uuid(), 
          order_id: orderId,
          product_id: i.productId,
          name: i.name,
          quantity: Number(i.quantity) || 0,
          processing_quantity: Number(i.processingQuantity) || 0,
          shipped_quantity: Number(i.shippedQuantity) || 0,
          unit_price: Number(i.unitPrice) || 0,
          cost_price: Number(i.costPrice) || 0
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(itemsToSave);
        
        if (itemsError) {
          console.error('DATABASE ERROR [Order Items]:', itemsError);
          throw new Error(`Gagal simpan item pesanan: ${itemsError.message}`);
        }
      }

      // 3. Refresh Payments (Hapus yang lama, masukkan yang baru)
      const { error: deletePaymentsError } = await supabase
        .from('payments')
        .delete()
        .eq('order_id', orderId);
      
      if (deletePaymentsError) console.warn('Peringatan: Gagal hapus pembayaran lama:', deletePaymentsError);

      if (order.payments && order.payments.length > 0) {
        const paymentsToSave = order.payments.map(p => ({
          id: p.id && p.id.length > 10 ? p.id : gen_uuid(),
          order_id: orderId,
          amount: Number(p.amount) || 0,
          date: p.date || new Date().toISOString(),
          note: p.note || ''
        }));

        const { error: paymentsError } = await supabase
          .from('payments')
          .insert(paymentsToSave);
        
        if (paymentsError) {
          console.error('DATABASE ERROR [Payments]:', paymentsError);
          throw new Error(`Gagal simpan pembayaran: ${paymentsError.message}`);
        }
      }

      console.log('BERHASIL SIMPAN KE SUPABASE:', order.invoiceNumber);
      return true;
    } catch (error: any) {
      console.error('FATAL SAVE ERROR:', error);
      throw error;
    }
  },

  async deleteOrder(id: string) {
    // Cascading deletes usually handle order_items and payments if configured in SQL
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  formatError(error: any, action: string): string {
    return `Gagal ${action}: ${error.message || 'Error tidak diketahui'}`;
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

