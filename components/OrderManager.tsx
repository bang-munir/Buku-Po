import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, Search,
  Edit2, X, AlertCircle, Wallet, Clock, Calendar,
  Users, RotateCcw
} from 'lucide-react';
import { AppState, Order, OrderItem, Product, OrderStatus, LocationType } from '../types';
// Fix: Remove unused dbService import
// import { dbService } from '../services/dbService';

interface Props {
  state: AppState;
  editingOrderExtern?: Order | null;
  setEditingOrderExtern?: (o: Order | null) => void;
  onAddOrder: (o: Order) => Promise<any>;
  onUpdateOrder: (o: Order) => Promise<any>;
  onDeleteOrder: (id: string) => Promise<any>;
  onUpdateDeposit: (d: CustomerDeposit) => Promise<any>;
  onViewInvoice: (o: Order) => void;
  onViewShippingInvoice: (o: Order, lastShipmentQtys?: Record<string, number>, lastShipmentDP?: number) => void;
  onNotify: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

type TabType = 'masuk' | 'dikerjakan' | 'dikirim';

const OrderManager: React.FC<Props> = ({ 
  state, 
  editingOrderExtern,
  setEditingOrderExtern,
  onAddOrder, 
  onUpdateOrder, 
  onDeleteOrder, 
  onUpdateDeposit,
  onViewInvoice, 
  onViewShippingInvoice,
  onNotify
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('masuk');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (editingOrderExtern) {
      setEditingOrder(editingOrderExtern);
    }
  }, [editingOrderExtern]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // States for Order Form
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [orderItems, setOrderItems] = useState<{ productId: string, qty: number | string, name: string, price: number }[]>([]);
  const [notes, setNotes] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [downPayment, setDownPayment] = useState(0);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // States for Progress Modal (Kerjakan/Kirim)
  const [progressOrder, setProgressOrder] = useState<Order | null>(null);
  const [progressQtys, setProgressQtys] = useState<Record<string, number | string>>({});
  const [progressMode, setProgressMode] = useState<'START' | 'SHIP'>('START');
  const [progressUseDeposit, setProgressUseDeposit] = useState(0);

  useEffect(() => {
    if (editingOrder) {
      setSelectedCustomerId(editingOrder.customerId || '');
      setOrderItems(editingOrder.items ? editingOrder.items.map(i => ({ 
        productId: i.productId, 
        qty: i.quantity,
        name: i.name,
        price: i.unitPrice
      })) : []);
      setNotes(editingOrder.notes || '');
      setOrderDate(new Date(editingOrder.orderDate).toISOString().split('T')[0]);
      setDownPayment(editingOrder.downPayment || 0);
      setIsFormOpen(true);
    }
  }, [editingOrder]);

  const selectedCustomer = useMemo(() => 
    state.customers.find(c => c.id === selectedCustomerId), 
    [state.customers, selectedCustomerId]
  );

  const totalBelanja = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + (item.price * (Number(item.qty) || 0)), 0);
  }, [orderItems]);

  const sisaTagihan = useMemo(() => {
    // Saat input order baru, sisa = total (Deposit terpakai dipindah ke menu Kirim)
    return Math.max(0, totalBelanja);
  }, [totalBelanja]);

  const addProductToItems = (p: Product) => {
    const exists = orderItems.find(oi => oi.productId === p.id);
    if (!exists) {
      const price = selectedCustomer?.type === LocationType.LUAR_KOTA ? p.priceLuarKota : p.priceJakarta;
      setOrderItems([...orderItems, { productId: p.id, name: p.name, qty: '', price: price }]);
    }
    setProductSearch('');
    setShowProductDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!selectedCustomerId || orderItems.length === 0) {
      setFormError("Pilih pelanggan dan minimal satu barang.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const items: OrderItem[] = orderItems.map(oi => {
        const p = state.products.find(product => product.id === oi.productId);
        const oldItem = editingOrder?.items.find(item => item.productId === oi.productId);
        
        const itemData: any = {
          id: (oldItem?.id && oldItem.id.length > 10) ? oldItem.id : `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          productId: p!.id,
          name: p!.name,
          quantity: Number(oi.qty),
          processingQuantity: oldItem?.processingQuantity || 0,
          shippedQuantity: oldItem?.shippedQuantity || 0,
          unitPrice: oi.price,
          costPrice: Number(p!.costPrice || 0)
        };
        
        return itemData as OrderItem;
      });

      const orderData: any = {
        id: (editingOrder?.id && editingOrder.id.length > 10) ? editingOrder.id : `ord_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        invoiceNumber: editingOrder ? editingOrder.invoiceNumber : `INV-${Date.now().toString().slice(-6)}`,
        customerId: selectedCustomerId,
        customerName: selectedCustomer!.name,
        customerType: selectedCustomer!.type,
        customerAddress: selectedCustomer!.address || '',
        orderDate: new Date(orderDate).toISOString(),
        status: editingOrder?.status || OrderStatus.PENDING,
        items: items,
        subtotal: totalBelanja,
        downPayment: downPayment,
        payments: editingOrder ? editingOrder.payments : [],
        total: totalBelanja - downPayment - (editingOrder?.depositUsed || 0),
        notes: notes.trim(),
        depositUsed: editingOrder?.depositUsed || 0
      };

      if (editingOrder) {
        await onUpdateOrder(orderData);
      } else {
        await onAddOrder(orderData);
      }
      resetForm();
    } catch (err: any) {
      setFormError(`Gagal menyimpan data: ${err.message || 'Error tidak diketahui'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progressOrder || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const updatedItems = progressOrder.items.map(item => {
        const qty = Number(progressQtys[item.id]) || 0;
        if (qty <= 0) return item;

        if (progressMode === 'START') {
          return {
            ...item,
            processingQuantity: item.processingQuantity + qty
          };
        } else {
          return {
            ...item,
            processingQuantity: Math.max(0, item.processingQuantity - qty),
            shippedQuantity: item.shippedQuantity + qty
          };
        }
      });

      const isFullyCompleted = updatedItems.every(i => i.shippedQuantity >= i.quantity);
      const balanceUsed = Number(progressUseDeposit) || 0;

      const newPayments = [...(progressOrder.payments || [])];
      if (balanceUsed > 0) {
        newPayments.push({
          id: `pay_ship_balance_${Date.now()}`,
          amount: balanceUsed,
          date: progressOrder.orderDate,
          note: `[Potong DP] Dp Masuk (Nota ${progressOrder.invoiceNumber})`
        });
      }

      // Update deposit data first (before final order update to avoid sync issues)
      if (balanceUsed > 0) {
        let amountToDeduct = balanceUsed;
        const customerDeps = state.deposits
          .filter(d => d.customerId === progressOrder.customerId && (d.amount - d.usedAmount) > 0)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        for (const dep of customerDeps) {
          if (amountToDeduct <= 0) break;
          const available = dep.amount - dep.usedAmount;
          const deduct = Math.min(available, amountToDeduct);
          
          await onUpdateDeposit({
            ...dep,
            usedAmount: dep.usedAmount + deduct
          });
          amountToDeduct -= deduct;
        }
      }

      // Final Order Update triggers last sync
      const finalOrder: Order = {
        ...progressOrder,
        items: updatedItems,
        status: isFullyCompleted ? OrderStatus.SHIPPED : progressOrder.status,
        downPayment: (progressOrder.downPayment || 0) + balanceUsed,
        depositUsed: (progressOrder.depositUsed || 0) + balanceUsed,
        total: Math.max(0, (progressOrder.total || 0) - balanceUsed),
        payments: newPayments
      };

      await onUpdateOrder(finalOrder);

      onNotify(progressMode === 'START' ? "Berhasil dipindahkan ke produksi" : "Barang berhasil dikirim", "success");
      
      if (progressMode === 'SHIP') {
        const sessionQtys: Record<string, number> = {};
        Object.keys(progressQtys).forEach(id => {
          if (progressQtys[id]) sessionQtys[id] = Number(progressQtys[id]);
        });
        // We delay slightly to allow parent state to sync if needed
        setTimeout(() => {
          onViewShippingInvoice(finalOrder, sessionQtys, balanceUsed);
        }, 300);
      }

      setProgressOrder(null);
      setProgressQtys({});
      setProgressUseDeposit(0);
    } catch (err: any) {
      console.error("Progress update error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setSelectedCustomerId('');
    setOrderItems([]);
    setDownPayment(0);
    setNotes('');
    setProductSearch('');
    setIsSubmitting(false);
    setFormError(null);
    setEditingOrder(null);
    if (setEditingOrderExtern) setEditingOrderExtern(null);
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex justify-between items-center bg-white p-2 md:p-3 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-sm font-black text-slate-900 uppercase ml-2">Order</h2>
        <button onClick={() => setIsFormOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg flex items-center gap-1.5">
          <Plus size={14} /> Baru
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-4 md:p-5 space-y-3 animate-in slide-in-from-top-6 duration-700 max-w-4xl mx-auto">
           <div className="flex justify-between items-center border-b border-slate-50 pb-1">
             <div>
               <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">Input Order</h3>
             </div>
             <button onClick={resetForm} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><X size={18}/></button>
           </div>

           {formError && (
             <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-center gap-2 text-rose-600 animate-in shake duration-300">
               <AlertCircle size={16} className="shrink-0" />
               <p className="text-[10px] font-bold leading-relaxed">{formError}</p>
             </div>
           )}

           <form onSubmit={handleSubmit} className="space-y-4">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 bg-slate-50/50 p-2 rounded-xl border border-slate-50">
                <div className="space-y-1">
                   <label className="text-[8px] font-black text-slate-500 uppercase ml-1 flex items-center gap-1">
                     <Users size={10} className="text-indigo-500" /> Pelanggan
                   </label>
                   <select required className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none font-bold text-slate-700 text-[10px] appearance-none" value={selectedCustomerId || ''} onChange={e => setSelectedCustomerId(e.target.value)}>
                     <option value="">-- Pilih --</option>
                     {state.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                   </select>
                </div>
                <div className="space-y-1">
                   <label className="text-[8px] font-black text-slate-500 uppercase ml-1 flex items-center gap-1">
                     <Calendar size={10} className="text-indigo-500" /> Tanggal
                   </label>
                   <input 
                     type="date" 
                     className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none font-bold text-slate-700 text-[10px]" 
                     value={orderDate || ''} 
                     onChange={e => setOrderDate(e.target.value)} 
                   />
                </div>
                <div className="space-y-1">
                   <label className="text-[8px] font-black text-slate-500 uppercase ml-1 flex items-center gap-1">
                     <Wallet size={10} className="text-emerald-500" /> DP (Rp)
                   </label>
                   <div className="relative">
                     <input 
                       type="number" 
                       placeholder="0"
                       className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none font-bold text-slate-700 text-[10px]" 
                       value={downPayment || ''} 
                       onChange={e => {
                         const val = Number(e.target.value);
                         setDownPayment(isNaN(val) ? 0 : val);
                       }} 
                     />
                   </div>
                </div>
             </div>

              <div className="space-y-2">
                <div className="relative" ref={dropdownRef}>
                  <label className="text-[8px] font-black text-slate-500 uppercase mb-1 block ml-1">Cari Barang</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                    <input type="text" placeholder="Nama barang..." className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white outline-none font-bold text-[11px]" value={productSearch} onFocus={() => setShowProductDropdown(true)} onChange={e => setProductSearch(e.target.value)} />
                  </div>
                  {showProductDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                      {state.products.filter(p => (p.name || '').toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                        <button key={p.id} type="button" onClick={() => addProductToItems(p)} className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0 font-bold text-[10px] flex justify-between items-center transition-colors">
                          <span className="text-slate-700">{p.name}</span>
                          <span className="text-[8px] font-black text-indigo-500 uppercase">Rp {p.price?.toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-100 max-h-[250px] overflow-y-auto no-scrollbar">
                   {orderItems.map((item, index) => (
                     <div key={item.productId} className="p-2 bg-white rounded-lg flex items-center justify-between gap-2 shadow-sm">
                        <div className="flex-1 min-w-0"><p className="text-[10px] font-black text-slate-800 uppercase truncate">{item.name}</p></div>
                        <div className="flex items-center gap-2 shrink-0">
                           <input 
                             type="number" 
                             placeholder="QTY" 
                             className="w-12 py-1 text-center bg-slate-50 border border-slate-100 rounded-md font-black text-[10px] outline-none" 
                             value={item.qty ?? ''} 
                             onChange={e => {
                               const val = e.target.value;
                               const num = Number(val);
                               setOrderItems(orderItems.map((oi, i) => i === index ? { ...oi, qty: val === '' ? '' : (isNaN(num) ? 0 : num) } : oi));
                             }} 
                           />
                           <p className="text-[10px] font-black text-indigo-600 min-w-[60px] text-right">Rp {(Number(item.qty)*item.price).toLocaleString()}</p>
                           <button type="button" onClick={() => setOrderItems(orderItems.filter((_, i) => i !== index))} className="p-1 text-slate-200 hover:text-rose-500"><Trash2 size={14}/></button>
                        </div>
                     </div>
                   ))}
                   {orderItems.length === 0 && (
                      <div className="py-8 text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase italic">Kosong</p>
                      </div>
                   )}
                </div>
             </div>

             <div className="bg-slate-900 p-4 rounded-2xl text-white flex justify-between items-center shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">TOTAL TAGIHAN</p>
                  <h4 className="text-xl font-black tracking-tighter">Rp {sisaTagihan.toLocaleString()}</h4>
                </div>
                <div className="flex gap-2 relative z-10">
                    <button type="submit" disabled={isSubmitting || orderItems.length === 0} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-black text-[9px] uppercase tracking-widest shadow-md hover:bg-indigo-500 active:scale-95 disabled:opacity-50">
                       {isSubmitting ? '...' : 'SIMPAN'}
                    </button>
                    <button type="button" onClick={resetForm} className="px-4 py-2.5 rounded-lg bg-slate-800 text-slate-400 font-black text-[9px] uppercase tracking-widest hover:bg-slate-700 transition-all">
                      X
                    </button>
                </div>
             </div>
           </form>
        </div>
      )}

      {/* Main List Section */}
      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="p-3 border-b border-slate-50 flex flex-col sm:flex-row gap-2 items-center justify-between">
           <div className="flex bg-slate-50 p-1 rounded-xl gap-1 w-full sm:w-auto">
              {[
                { id: 'masuk', label: 'Masuk' },
                { id: 'dikerjakan', label: 'Kerja' },
                { id: 'dikirim', label: 'Kirim' }
              ].map(t => (
                <button 
                  key={t.id} 
                  onClick={() => setActiveTab(t.id as TabType)} 
                  className={`flex-1 px-4 py-2 rounded-lg font-black text-[8px] uppercase tracking-widest transition-all ${activeTab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                >
                  {t.label}
                </button>
              ))}
           </div>
           <div className="w-full sm:w-40">
              <select 
                className="w-full px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 font-black text-[9px] uppercase tracking-widest outline-none"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
              >
                <option value="">Semua</option>
                {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
           </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 text-[8px] font-black uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-5 py-3">Nota</th>
                <th className="px-5 py-3">Info</th>
                <th className="px-5 py-3 text-right">Nilai</th>
                <th className="px-5 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {state.orders
                .filter(o => o.status !== OrderStatus.CANCELLED)
                .filter(o => {
                  if (activeTab === 'masuk') return o.status !== OrderStatus.COMPLETED && o.items.some(item => item.quantity > (item.processingQuantity + item.shippedQuantity));
                  if (activeTab === 'dikerjakan') return o.status !== OrderStatus.COMPLETED && o.items.some(item => item.processingQuantity > 0);
                  if (activeTab === 'dikirim') return o.status !== OrderStatus.COMPLETED && o.items.some(item => item.shippedQuantity > 0);
                  return true;
                })
                .filter(o => {
                  if (!categoryFilter) return true;
                  return o.items.some(item => state.products.find(p => p.id === item.productId)?.categoryId === categoryFilter);
                })
                .map(o => {
                  const stageItems = o.items.map(item => {
                    let stageQty = 0;
                    if (activeTab === 'masuk') stageQty = item.quantity - item.processingQuantity - item.shippedQuantity;
                    else if (activeTab === 'dikerjakan') stageQty = item.processingQuantity;
                    else if (activeTab === 'dikirim') stageQty = item.shippedQuantity;
                    return { ...item, stageQty };
                  }).filter(i => i.stageQty > 0);
                  const stageTotal = stageItems.reduce((sum, item) => sum + (item.unitPrice * item.stageQty), 0);

                  return (
                    <tr key={o.id} className="hover:bg-slate-50/50 cursor-pointer group text-[10px]" onClick={() => onViewInvoice(o)}>
                    <td className="px-5 py-3 font-black text-slate-800 uppercase tracking-tighter">
                      {o.invoiceNumber}
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-bold text-slate-700 truncate max-w-[100px]">{o.customerName}</div>
                      <div className="mt-1 space-y-0.5">
                        {stageItems.slice(0, 2).map(si => (
                          <div key={si.id} className="flex items-center gap-1 font-bold">
                             <span className="text-[7px] font-black bg-slate-100 px-1 rounded text-slate-500">{si.stageQty}x</span>
                             <span className="text-[8px] text-slate-400 truncate max-w-[80px]">{si.name}</span>
                          </div>
                        ))}
                        {stageItems.length > 2 && <span className="text-[7px] text-indigo-400 font-black">+{stageItems.length - 2} lagi</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                       <div className="font-black text-indigo-600 leading-none">Rp {stageTotal.toLocaleString()}</div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {activeTab === 'masuk' && (
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setProgressOrder(o); 
                              setProgressMode('START'); 
                              setProgressQtys(Object.fromEntries(o.items.map(i => [i.id, '']))); 
                            }} 
                            className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-[8px] font-black uppercase shadow-sm hover:bg-emerald-700 transition-all"
                          >
                            Kerja
                          </button>
                        )}
                        {activeTab === 'dikerjakan' && (
                          <div className="flex gap-1">
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setProgressOrder(o); 
                                setProgressMode('SHIP'); 
                                setProgressQtys(Object.fromEntries(o.items.map(i => [i.id, '']))); 
                                setProgressUseDeposit(0);
                              }} 
                              className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[8px] font-black uppercase shadow-sm hover:bg-indigo-700"
                            >
                              Kirim
                            </button>
                            <button 
                              title="Batal Kerjakan"
                              onClick={async (e) => { 
                                e.stopPropagation(); 
                                if (!confirm("Kembalikan semua barang ke antrian Masuk?")) return;
                                const resetItems = o.items.map(i => ({ ...i, processingQuantity: 0 }));
                                await onUpdateOrder({
                                  ...o,
                                  items: resetItems,
                                  downPayment: 0,
                                  depositUsed: 0,
                                  total: o.subtotal,
                                  payments: []
                                });
                                onNotify("Antrian produksi dibatalkan & hitungan direset", "info");
                              }} 
                              className="bg-slate-100 text-slate-400 p-1 rounded-lg hover:text-amber-600 hover:bg-amber-50 transition-all"
                            >
                              <Clock size={12} />
                            </button>
                          </div>
                        )}
                        {activeTab === 'dikirim' && (
                          <div className="flex gap-1">
                            <button 
                               title="Tandai Lunas"
                               onClick={async (e) => {
                                 e.stopPropagation();
                                 if (!confirm("Tandai nota ini sebagai LUNAS? (Sisa tagihan akan menjadi 0)")) return;
                                 await onUpdateOrder({
                                   ...o,
                                   status: OrderStatus.COMPLETED,
                                   total: 0
                                 });
                                 onNotify("Nota ditandai Lunas", "success");
                               }}
                               className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[8px] font-black uppercase shadow-sm hover:bg-emerald-700"
                            >
                               Lunas
                            </button>
                            <button 
                               title="Batal Kirim (Reset)"
                               onClick={async (e) => {
                                 e.stopPropagation();
                                 if (!confirm("Tarik kembali semua barang yang sudah dikirim? (Status & Hitungan akan direset)")) return;
                                 
                                 try {
                                   const resetItems = o.items.map(i => ({ 
                                     ...i, 
                                     processingQuantity: i.processingQuantity + i.shippedQuantity,
                                     shippedQuantity: 0 
                                   }));
  
                                   // Sederhanakan sesuai permintaan user: Cukup kosongkan data keuangan nota
                                   // User akan update manual di menu Tabungan
                                   const finalOrder: Order = {
                                     ...o,
                                     items: resetItems,
                                     status: OrderStatus.PENDING,
                                     payments: [],
                                     downPayment: 0,
                                     depositUsed: 0,
                                     total: o.items.reduce((s, i) => s + (i.unitPrice * i.quantity), 0)
                                   };
  
                                   await onUpdateOrder(finalOrder);
                                   onNotify("Pengiriman dibatalkan & hitungan direset (Silakan update saldo manual)", "info");
                                 } catch (err: any) {
                                   onNotify("Gagal: " + err.message, "error");
                                 }
                               }}
                               className="bg-slate-100 text-slate-400 p-1.5 rounded-lg hover:text-amber-600 hover:bg-amber-50"
                            >
                               <RotateCcw size={13} />
                            </button>
                          </div>
                        )}
                        <div className="w-px h-4 bg-slate-100 mx-1"></div>
                        <button onClick={(e) => { e.stopPropagation(); setEditingOrder(o); setIsFormOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-indigo-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded-lg transition-all"><Edit2 size={13} /></button>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteOrder(o.id); }} className="text-rose-300 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={13}/></button>
                      </div>
                    </td>
                </tr>
                  );
                })}
              </tbody>
          </table>
        </div>
      </div>

      {/* Progress Update Modal */}
      {progressOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-tighter">
                  {progressMode === 'START' ? 'Pindahkan ke Produksi' : 'Kirim Barang'}
                </h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-wider">Invoice: {progressOrder.invoiceNumber}</p>
              </div>
              <button 
                onClick={() => setProgressOrder(null)} 
                className="p-2 text-slate-300 hover:text-rose-500 transition-all rounded-xl hover:bg-rose-50"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProgress} className="p-6 md:p-8 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
              <div className="space-y-4">
                {progressOrder.items.map((item) => {
                  const available = progressMode === 'START' 
                    ? item.quantity - item.processingQuantity - item.shippedQuantity
                    : item.processingQuantity;
                  
                  if (available <= 0 && progressMode === 'START') return null;
                  if (available <= 0 && progressMode === 'SHIP') {
                     // Check if it's already shipped but still in "Dikerjakan" tab logic? 
                     // No, if available in processing is 0, we can't ship more.
                     return null;
                  }

                  return (
                    <div key={item.id} className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl">
                      <div className="flex-1">
                        <p className="text-xs font-black text-slate-800 uppercase leading-none mb-1">{item.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                          {progressMode === 'START' 
                            ? `Tersisa di Masuk: ${available}` 
                            : `Tersedia di Produksi: ${available}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                         <div className="flex items-center gap-1.5 mr-2">
                           <input 
                             type="checkbox" 
                             id={`all_${item.id}`}
                             className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                             checked={Number(progressQtys[item.id]) === available}
                             onChange={(e) => {
                               if (e.target.checked) {
                                 setProgressQtys({ ...progressQtys, [item.id]: available });
                               } else {
                                 setProgressQtys({ ...progressQtys, [item.id]: '' });
                               }
                             }}
                           />
                           <label htmlFor={`all_${item.id}`} className="text-[9px] font-black text-slate-400 cursor-pointer uppercase">Semua</label>
                         </div>
                         <input 
                           type="number" 
                           max={available}
                           min={0}
                           placeholder="0"
                           className="w-16 px-2 py-2 rounded-xl bg-white border border-slate-200 font-black text-sm text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                           value={progressQtys[item.id] ?? ''}
                           onChange={e => {
                             const val = e.target.value;
                             const num = Number(val);
                             setProgressQtys({ ...progressQtys, [item.id]: val === '' ? '' : (isNaN(num) ? 0 : Math.min(available, num)) });
                           }}
                         />
                      </div>
                    </div>
                  );
                })}
              </div>

              {progressMode === 'SHIP' && (
                <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Wallet className="text-indigo-600" size={16} />
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Dp Masuk</span>
                    </div>
                    {progressOrder && (
                      <span className="text-[9px] font-bold text-slate-400">Tersedia: Rp {
                        state.deposits
                          .filter(d => d.customerId === progressOrder.customerId)
                          .reduce((sum, d) => sum + (d.amount - d.usedAmount), 0)
                          .toLocaleString()
                      }</span>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-indigo-400 uppercase tracking-widest ml-1">Nominal Rp</label>
                    <input 
                      type="number" 
                      placeholder="0" 
                      className="w-full px-3 py-2.5 rounded-xl bg-white border border-indigo-100 font-black text-indigo-700 text-xs focus:ring-4 focus:ring-indigo-500/10 outline-none"
                      value={progressUseDeposit ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        const num = Number(val);
                        if (val === '') {
                          setProgressUseDeposit(0);
                        } else {
                          const available = state.deposits
                              .filter(d => d.customerId === progressOrder?.customerId)
                              .reduce((sum, d) => sum + (d.amount - d.usedAmount), 0);
                          setProgressUseDeposit(isNaN(num) ? 0 : Math.min(available, num));
                        }
                      }}
                    />
                  </div>
                  <p className="text-[9px] font-bold text-indigo-500 italic">DP ini akan otomatis memotong saldo tabungan pelanggan.</p>
                </div>
              )}

              <div className="pt-4 border-t border-slate-50 flex justify-end">
                 <button 
                   type="submit" 
                   disabled={isSubmitting}
                   className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
                 >
                   {isSubmitting ? 'Memproses...' : (progressMode === 'START' ? 'Mulai Kerjakan' : 'Konfirmasi Pengiriman')}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManager;