import React, { useState, useMemo } from 'react';
import { Plus, Trash2, FilePlus, Calculator, Wallet } from 'lucide-react';
import { Order, OrderItem, OrderStatus, LocationType, PaymentRecord, Product, Customer } from '@/types';
import InvoiceView from './InvoiceView';

interface Props {
  products: Product[];
  customers: Customer[];
  onNotify: (msg: string, type: 'success' | 'info' | 'warning' | 'error') => void;
  onAddOrder?: (order: Order) => Promise<any>;
}

const ManualInvoiceManager: React.FC<Props> = ({ products, customers, onNotify, onAddOrder }) => {
  const [isPreview, setIsPreview] = useState(false);
  const [manualOrder, setManualOrder] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [downPayment, setDownPayment] = useState<number | undefined>(undefined);
  const [items, setItems] = useState<Partial<OrderItem>[]>([
    { id: `item_${Date.now()}_1`, name: '', quantity: undefined, unitPrice: undefined }
  ]);

  const addItem = () => {
    setItems([...items, { id: `item_${Date.now()}_${items.length + 1}`, name: '', quantity: undefined, unitPrice: undefined }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: string, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value === '' ? undefined : value } : i));
  };

  const formSubtotal = useMemo(() => {
    return items.reduce((sum, i) => sum + (Number(i.quantity || 0) * Number(i.unitPrice || 0)), 0);
  }, [items]);

  const remainingBalance = useMemo(() => {
    return Math.max(0, formSubtotal - (Number(downPayment) || 0));
  }, [formSubtotal, downPayment]);

  const createManualOrder = () => {
    const dpAmount = Number(downPayment) || 0;
    const orderId = `ord_manual_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const manualPayments: PaymentRecord[] = dpAmount > 0 ? [{
      id: `pay_manual_${Date.now()}`,
      amount: dpAmount,
      date: new Date().toISOString(),
      note: 'Uang Muka (Manual)'
    }] : [];

    const matchedCustomer = customers.find(c => c.name === customerName);

    const order: Order = {
      id: orderId,
      invoiceNumber: `M-${Date.now().toString().slice(-6)}`,
      customerId: matchedCustomer?.id || `cust_walkin_${Date.now()}`,
      customerName,
      customerAddress,
      customerType: matchedCustomer?.type || LocationType.JAKARTA,
      orderDate: new Date().toISOString(),
      status: remainingBalance <= 0 ? OrderStatus.PAID : OrderStatus.PENDING,
      items: items.map(i => ({
        id: i.id!.length > 10 ? i.id! : `item_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
        productId: 'manual',
        name: i.name || 'Barang Tanpa Nama',
        quantity: Number(i.quantity) || 0,
        processingQuantity: 0,
        shippedQuantity: 0,
        unitPrice: Number(i.unitPrice) || 0,
        costPrice: 0
      })),
      subtotal: formSubtotal,
      downPayment: dpAmount,
      payments: manualPayments,
      total: remainingBalance,
      depositUsed: 0,
      notes
    };
    return order;
  };

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    const order = createManualOrder();
    setManualOrder(order);
    setIsPreview(true);
  };

  const handleSave = async () => {
    if (!onAddOrder) return;
    const order = manualOrder || createManualOrder();
    
    setIsSubmitting(true);
    try {
      await onAddOrder(order);
      onNotify("Nota Manual Berhasil Disimpan", "success");
    } catch (err: any) {
      onNotify(`Gagal simpan: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isPreview && manualOrder) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => setIsPreview(false)} className="text-slate-500 hover:text-indigo-600 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
            ← Edit Data
          </button>
          <div className="flex gap-2">
            <button 
              onClick={handleSave} 
              disabled={isSubmitting}
              className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              Simpan Permanen
            </button>
            <div className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 flex items-center">
              Pratinjau Nota
            </div>
          </div>
        </div>
        <InvoiceView order={manualOrder} onNotify={onNotify} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="bg-white rounded-[1.5rem] shadow-xl border border-slate-100 p-4 md:p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-50 pb-1.5">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white shadow-md">
              <FilePlus size={16} />
            </div>
            <h2 className="text-sm font-black text-slate-900 tracking-tight uppercase">Nota Manual</h2>
          </div>
        </div>

        <form onSubmit={handlePreview} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/50 p-2.5 rounded-xl border border-slate-50">
            <datalist id="existing-customers">
              {customers.map(c => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Pelanggan</label>
              <input 
                required 
                list="existing-customers"
                placeholder="Nama..." 
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none font-bold text-xs" 
                value={customerName} 
                onChange={e => {
                  const val = e.target.value;
                  setCustomerName(val);
                  const matched = customers.find(c => c.name === val);
                  if (matched) {
                    setCustomerAddress(matched.address);
                  }
                }} 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Alamat</label>
              <input placeholder="Alamat..." className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none font-bold text-xs" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Calculator size={10} className="text-indigo-500" /> Daftar Barang
              </h3>
              <button type="button" onClick={addItem} className="text-[8px] font-black text-indigo-600 uppercase flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                <Plus size={10} /> Tambah
              </button>
            </div>

            <div className="space-y-1.5 bg-slate-50 p-2 rounded-xl border border-slate-50">
              <datalist id="catalog-products">
                {products.map(p => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
              {items.map((item) => {
                const itemTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                return (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-100">
                    <div className="col-span-12 lg:col-span-6">
                      <input 
                        required 
                        list="catalog-products"
                        placeholder="Nama barang..." 
                        className="w-full px-1.5 py-1 bg-transparent outline-none font-black text-slate-700 text-[10px] border-b border-slate-100 focus:border-indigo-500" 
                        value={item.name} 
                        onChange={e => {
                          const val = e.target.value;
                          updateItem(item.id!, 'name', val);
                        }} 
                      />
                    </div>
                    <div className="col-span-3 lg:col-span-2">
                      <input 
                        required 
                        type="number" 
                        placeholder="Qty" 
                        className="w-full bg-transparent outline-none font-black text-slate-700 text-[10px] text-center border-b border-slate-100" 
                        value={item.quantity === undefined ? '' : item.quantity} 
                        onChange={e => {
                          const val = e.target.value;
                          const num = Number(val);
                          updateItem(item.id!, 'quantity', val === '' ? undefined : (isNaN(num) ? 0 : num));
                        }} 
                      />
                    </div>
                    <div className="col-span-4 lg:col-span-2">
                      <input 
                        required 
                        type="number" 
                        placeholder="Harga" 
                        className="w-full bg-transparent outline-none font-black text-slate-700 text-[10px] border-b border-slate-100" 
                        value={item.unitPrice === undefined ? '' : item.unitPrice} 
                        onChange={e => {
                          const val = e.target.value;
                          const num = Number(val);
                          updateItem(item.id!, 'unitPrice', val === '' ? undefined : (isNaN(num) ? 0 : num));
                        }} 
                      />
                    </div>
                    <div className="col-span-4 lg:col-span-1 text-right lg:block hidden">
                      <p className="text-[9px] font-black text-indigo-600 truncate">Rp {itemTotal.toLocaleString()}</p>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button type="button" onClick={() => removeItem(item.id!)} className="text-slate-300 hover:text-rose-500 p-0.5"><Trash2 size={12} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-start pt-3 border-t border-slate-50">
            <div className="flex-1 w-full space-y-3">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Catatan</label>
                <textarea className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 outline-none font-medium text-[10px] h-12 resize-none" placeholder="Tambahan..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Wallet size={10} className="text-emerald-500" />
                  <h3 className="text-[8px] font-black text-slate-800 uppercase tracking-widest">Input DP</h3>
                </div>
                <input 
                  type="number" 
                  placeholder="0" 
                  className="w-full max-w-[120px] px-3 py-1.5 rounded-lg border border-emerald-100 bg-emerald-50/30 outline-none font-black text-emerald-700 text-xs" 
                  value={downPayment === undefined ? '' : downPayment} 
                  onChange={e => {
                    const val = e.target.value;
                    const num = Number(val);
                    setDownPayment(val === '' ? undefined : (isNaN(num) ? 0 : num));
                  }} 
                />
              </div>
            </div>

            <div className="w-full md:w-60 bg-slate-900 rounded-2xl p-4 text-white shadow-lg space-y-2">
               <div className="flex justify-between items-center">
                 <p className="text-[7px] font-black text-slate-400 uppercase">Jumlah</p>
                 <p className="text-[10px] font-bold text-slate-500 line-through">Rp {formSubtotal.toLocaleString()}</p>
               </div>
               <div className="flex justify-between items-center">
                 <p className="text-[7px] font-black text-emerald-400 uppercase">Dibayar</p>
                 <p className="text-[10px] font-bold text-emerald-400">Rp {(Number(downPayment) || 0).toLocaleString()}</p>
               </div>
               <div className="pt-2 border-t border-white/10 flex justify-between items-end">
                 <div>
                  <p className="text-[7px] font-black text-indigo-400 uppercase mb-0.5">Sisa</p>
                  <h4 className="text-lg font-black tracking-tighter">Rp {remainingBalance.toLocaleString()}</h4>
                 </div>
                 <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                  LIHAT
                </button>
               </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualInvoiceManager;