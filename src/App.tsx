import React, { useState, useEffect, useCallback, useRef } from 'react';
declare global {
  namespace JSX { interface IntrinsicElements { [elemName: string]: any; } }
}
import { 
  LayoutDashboard, Users, Box, ShoppingCart, BarChart3, 
  Menu, Loader2, FilePlus, RefreshCw, Wallet, FileText
} from 'lucide-react';
import { AppState, Order, ViewType } from './types';
import MainDashboard from './components/MainDashboard';
import CustomerManager from './components/CustomerManager';
import ProductManager from './components/ProductManager';
import OrderManager from './components/OrderManager';
import InvoiceView from './components/InvoiceView';
import Reports from './components/Reports';
import InvoiceBook from './components/InvoiceBook';
import ManualInvoiceManager from './components/ManualInvoiceManager';
import PaymentManager from './components/PaymentManager';
import { dbService } from './services/dbService';
import { checkSupabaseConnection } from './lib/supabase';

const APP_LOGO_SVG = "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI+CiAgPHJlY3QgeD0iNTAiIHk9IjcwIiB3aWR0aD0iNDEyIiBoZWlnaHQ9IjQxMiIgcng9IjQwIiBmaWxsPSIjZDkwMDAwIiAvPgogIDxwYXRoIGQ9Ik0xMDAgMTEwIEg0MTIgVjQwMCBMMzgyIDQzMCBIMTAwIFoiIGZpbGw9IndoaXRlIiAvPgogIDx0ZXh0IHg9IjI0NSIgeT0iMjY1IiBmb250LWZhbWlseT0iQXJpYWwgQmxhY2siIGZvbnQtd2VpZ2h0PSI5MDAiIGZvbnQtc2l6ZT0iMTE1IiBmaWxsPSIjZDkwMDAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5QTzwvdGV4dD4KICA8cmVjdCB4PSIxODAiIHk9IjMwIiB3aWR0aD0iMTUyIiBoZWlnaHQ9IjcwIiByeD0iMTUiIGZpbGw9IiM5OTk5OTkiIC8+Cjwvc3ZnPg==";

interface Notification {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    orders: [],
    customers: [],
    products: [],
    categories: [],
    deposits: [],
    activeOrder: null,
    invoiceMode: 'full',
    lastShipmentQtys: null,
    lastShipmentDP: null,
    autoDownloadInvoice: false,
    view: 'dashboard',
  });

  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const loadAttempted = useRef(false);

  const showNotify = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setNotification({ message, type });
    if (type !== 'error') setTimeout(() => setNotification(null), 3000);
  }, []);

  const deleteOrderWithRefund = async (id: string) => {
    const order = state.orders.find(o => o.id === id);
    if (!order) return;

    if (!confirm(`Hapus order ${order.invoiceNumber}? Saldo akan dikembalikan.`)) return;

    try {
      setIsRefreshing(true);
      
      // 1. Refund depositUsed
      if (order.depositUsed && order.depositUsed > 0) {
        let amountToRefund = order.depositUsed;
        const customerDeps = state.deposits
          .filter(d => d.customerId === order.customerId && d.usedAmount > 0)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        for (const dep of customerDeps) {
          if (amountToRefund <= 0) break;
          const refund = Math.min(dep.usedAmount, amountToRefund);
          await dbService.upsertDeposit({
            ...dep,
            usedAmount: Math.max(0, dep.usedAmount - refund)
          });
          amountToRefund -= refund;
        }
      }

      // 2. Any other payments should be added as a NEW deposit
      const cashPaid = (order.downPayment || 0) + (order.payments || [])
        .filter(p => !p.note?.includes('[Potong DP]'))
        .reduce((sum, p) => sum + p.amount, 0);

      if (cashPaid > 0) {
        await dbService.upsertDeposit({
          id: `ref_${Date.now()}_${id}`,
          customerId: order.customerId,
          customerName: order.customerName,
          amount: cashPaid,
          usedAmount: 0,
          date: new Date().toISOString(),
          notes: `REFUND: Order ${order.invoiceNumber}`
        } as any);
      }

      await dbService.deleteOrder(id);
      showNotify("Data telah dihapus & saldo dipulihkan", "success");
      
      if (state.activeOrder?.id === id) {
        setView('dashboard');
      }

      loadAllData(true);
    } catch (err: any) {
      showNotify(`Gagal menghapus: ${err.message}`, "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadAllData = useCallback(async (isSilent = false) => {
    if (!isSilent) setInitialLoading(true);
    else setIsRefreshing(true);

    try {
      const connection = await checkSupabaseConnection();
      if (connection.connected) {
        const [customers, products, categories, orders, deposits] = await Promise.all([
          dbService.getCustomers(),
          dbService.getProducts(),
          dbService.getCategories(),
          dbService.getOrders(),
          dbService.getDeposits()
        ]);
        setState(prev => ({ ...prev, customers, products, categories, orders, deposits }));
      } else {
        showNotify(connection.message, "error");
      }
    } catch (e: any) {
      console.error("Sync Error:", e);
      showNotify(`Gagal sinkron: ${e.message || 'Cek koneksi internet'}`, "error");
    } finally {
      setInitialLoading(false);
      setIsRefreshing(false);
    }
  }, [showNotify]);

  useEffect(() => {
    if (!loadAttempted.current) {
      loadAttempted.current = true;
      loadAllData();
      
      // Safety timeout: stop loading screen after 7 seconds regardless
      const timer = setTimeout(() => {
        setInitialLoading(false);
      }, 7000);
      
      return () => clearTimeout(timer);
    }
  }, [loadAllData]);

  const setView = useCallback((view: ViewType) => {
    setState(prev => ({ 
      ...prev, 
      view, 
      activeOrder: null,
      lastShipmentQtys: null,
      lastShipmentDP: null,
      autoDownloadInvoice: false
    }));
    setEditingOrder(null);
    setIsMobileMenuOpen(false);
  }, []);

  if (initialLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
      <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl mb-8">
        <img src={`data:image/svg+xml;base64,${APP_LOGO_SVG}`} className="w-16 h-16" />
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          <span className="text-[10px] font-black tracking-[0.4em] uppercase">Mempersiapkan...</span>
        </div>
        <p className="text-slate-500 text-[10px] max-w-xs leading-relaxed">
          Jika proses ini terlalu lama, pastikan koneksi internet stabil & database Supabase aktif.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans overflow-x-hidden">
      {notification && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-4 ${
          notification.type === 'success' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-white'
        }`}>
          <span className="text-xs font-black uppercase tracking-wider">{notification.message}</span>
        </div>
      )}

      <aside className={`w-56 bg-slate-900 text-slate-300 flex flex-col fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:sticky md:h-screen shadow-2xl`}>
        <div className="p-4 flex items-center gap-2">
          <img src={`data:image/svg+xml;base64,${APP_LOGO_SVG}`} className="w-6 h-6 rounded-lg" />
          <span className="text-sm font-black text-white uppercase tracking-tighter">Buku PO</span>
        </div>
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto no-scrollbar">
          <NavItem icon={<LayoutDashboard size={16} />} label="Home" active={state.view === 'dashboard'} onClick={() => setView('dashboard')} />
          <NavItem icon={<FilePlus size={16} />} label="Nota Manual" active={state.view === 'manual_invoice'} onClick={() => setView('manual_invoice')} />
          <NavItem icon={<ShoppingCart size={16} />} label="Order" active={state.view === 'orders'} onClick={() => setView('orders')} />
          <NavItem icon={<FileText size={16} />} label="Buku Nota" active={state.view === 'invoice_book'} onClick={() => setView('invoice_book')} />
          <NavItem icon={<Wallet size={16} />} label="DP Masuk" active={state.view === 'dp_tracker'} onClick={() => setView('dp_tracker')} />
          <NavItem icon={<BarChart3 size={16} />} label="Laporan" active={state.view === 'reports'} onClick={() => setView('reports')} />
          <NavItem icon={<Users size={16} />} label="Customer" active={state.view === 'customers'} onClick={() => setView('customers')} />
          <NavItem icon={<Box size={16} />} label="Katalog" active={state.view === 'products'} onClick={() => setView('products')} />
        </nav>
      </aside>

      <main className="flex-1 h-screen flex flex-col overflow-hidden">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 h-12 flex items-center px-4 md:px-5 sticky top-0 z-30 justify-between">
           <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-slate-600 mr-3"><Menu size={18}/></button>
           <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">{state.view.replace('_', ' ')}</h2>
           <button onClick={() => loadAllData(true)} className={`p-2 text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`}><RefreshCw size={14}/></button>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar p-3 md:p-4 lg:p-5">
          <div className="max-w-7xl mx-auto">
            {state.view === 'dashboard' && <MainDashboard state={state} onNavigate={setView} />}
            {state.view === 'manual_invoice' && (
              <ManualInvoiceManager 
                products={state.products} 
                customers={state.customers} 
                onNotify={showNotify} 
                onAddOrder={(o) => dbService.upsertOrder(o).then(() => {
                  loadAllData(true);
                  setView('orders');
                })}
              />
            )}
            {state.view === 'customers' && <CustomerManager customers={state.customers} onAdd={(c) => dbService.upsertCustomer(c).then(() => loadAllData(true))} onUpdate={(c) => dbService.upsertCustomer(c).then(() => loadAllData(true))} onDelete={(id) => dbService.deleteCustomer(id).then(() => loadAllData(true))} />}
            {state.view === 'products' && (
              <ProductManager 
                products={state.products} 
                categories={state.categories}
                onAdd={(p) => dbService.upsertProduct(p).then(() => loadAllData(true))} 
                onUpdate={(p) => dbService.upsertProduct(p).then(() => loadAllData(true))} 
                onDelete={(id) => dbService.deleteProduct(id).then(() => loadAllData(true))}
                onAddCategory={(c) => dbService.upsertCategory(c).then(() => loadAllData(true))}
                onDeleteCategory={(id) => dbService.deleteCategory(id).then(() => loadAllData(true))}
              />
            )}
            {state.view === 'orders' && (
              <OrderManager 
                state={state} 
                editingOrderExtern={editingOrder}
                setEditingOrderExtern={setEditingOrder}
                onAddOrder={(o) => {
                  setState(prev => ({ ...prev, orders: [o, ...prev.orders] }));
                  return dbService.upsertOrder(o).then(() => loadAllData(true));
                }} 
                onUpdateOrder={(o) => {
                  setState(prev => ({
                    ...prev,
                    orders: prev.orders.map(old => old.id === o.id ? o : old)
                  }));
                  return dbService.upsertOrder(o).then(() => loadAllData(true));
                }} 
                onDeleteOrder={deleteOrderWithRefund} 
                onUpdateDeposit={(d) => dbService.upsertDeposit(d).then(() => loadAllData(true))}
                onAddDeposit={(d) => dbService.upsertDeposit(d).then(() => loadAllData(true))}
                onViewInvoice={(o) => setState(p => ({...p, activeOrder: o, view: 'invoice_detail', invoiceMode: 'full', lastShipmentQtys: null, lastShipmentDP: null, autoDownloadInvoice: false}))} 
                onViewShippingInvoice={(o, qtys, dp) => setState(p => ({...p, activeOrder: o, view: 'invoice_detail', invoiceMode: 'shipping', lastShipmentQtys: qtys || null, lastShipmentDP: dp || null, autoDownloadInvoice: false}))}
                onNotify={showNotify}
              />
            )}
            {state.view === 'dp_tracker' && (
              <PaymentManager 
                state={state} 
                onUpdateOrder={(o) => {
                  setState(prev => ({
                    ...prev,
                    orders: prev.orders.map(old => old.id === o.id ? o : old)
                  }));
                  return dbService.upsertOrder(o).then(() => loadAllData(true));
                }} 
                onAddDeposit={(d) => dbService.upsertDeposit(d).then(() => loadAllData(true))} 
                onUpdateDeposit={(d) => dbService.upsertDeposit(d).then(() => loadAllData(true))}
                onDeleteDeposit={(id) => dbService.deleteDeposit(id).then(() => loadAllData(true))}
                onNotify={showNotify} 
                onViewInvoice={(o) => setState(p => ({...p, activeOrder: o, view: 'invoice_detail', invoiceMode: 'full', lastShipmentQtys: null, lastShipmentDP: null, autoDownloadInvoice: false}))}
              />
            )}
            {state.view === 'reports' && (
              <Reports 
                state={state} 
                onViewInvoice={(o) => setState(p => ({...p, activeOrder: o, view: 'invoice_detail', invoiceMode: 'full', lastShipmentQtys: null, lastShipmentDP: null, autoDownloadInvoice: false}))}
                onDeleteOrder={deleteOrderWithRefund}
                setEditingOrderExtern={setEditingOrder}
                setView={setView}
              />
            )}
            {state.view === 'invoice_book' && (
              <InvoiceBook 
                state={state} 
                onUpdateOrder={(o) => {
                  setState(prev => ({
                    ...prev,
                    orders: prev.orders.map(old => old.id === o.id ? o : old)
                  }));
                  return dbService.upsertOrder(o).then(() => loadAllData(true));
                }}
                onDeleteOrder={deleteOrderWithRefund}
                onNotify={showNotify}
                onViewInvoice={(o) => setState(p => ({...p, activeOrder: o, view: 'invoice_detail', invoiceMode: 'full', lastShipmentQtys: null, lastShipmentDP: null, autoDownloadInvoice: false}))}
                setEditingOrderExtern={setEditingOrder}
                setView={setView}
              />
            )}
            {state.view === 'invoice_detail' && state.activeOrder && (
              <InvoiceView 
                order={state.activeOrder} 
                mode={state.invoiceMode} 
                onNotify={showNotify} 
                sessionQtys={state.lastShipmentQtys}
                sessionDP={state.lastShipmentDP}
                autoDownload={state.autoDownloadInvoice}
                onBack={() => setState(p => ({...p, view: 'orders', activeOrder: null, lastShipmentQtys: null, lastShipmentDP: null, autoDownloadInvoice: false}))}
              />
            )}
          </div>
        </div>
      </main>
      {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/40 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${active ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
    {icon} <span>{label}</span>
  </button>
);

export default App;