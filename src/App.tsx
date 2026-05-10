import React, { useState, useEffect, useCallback, useRef } from 'react';
declare global {
  namespace JSX { interface IntrinsicElements { [elemName: string]: any; } }
}
import { 
  LayoutDashboard, Users, Box, ShoppingCart, BarChart3, 
  Menu, Loader2, FilePlus, RefreshCw, Wallet, FileText, Settings as SettingsIcon, LogOut,
  CheckCircle2, AlertCircle, Info, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppState, Order, ViewType } from '@/types';
import Dashboard from '@/components/Dashboard';
import CustomerManager from '@/components/CustomerManager';
import ProductManager from '@/components/ProductManager';
import OrderManager from '@/components/OrderManager';
import InvoiceView from '@/components/InvoiceView';
import Reports from '@/components/Reports';
import InvoiceBook from '@/components/InvoiceBook';
import ManualInvoiceManager from '@/components/ManualInvoiceManager';
import PaymentManager from '@/components/PaymentManager';
import Settings from '@/components/Settings';
import Login from '@/components/Login';
import { dbService } from '@/services/dbService';
import { supabase, checkSupabaseConnection } from '@/lib/supabase';

const APP_LOGO_SVG = "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI+CiAgPHJlY3QgeD0iNTAiIHk9IjcwIiB3aWR0aD0iNDEyIiBoZWlnaHQ9IjQxMiIgcng9IjQwIiBmaWxsPSIjZDkwMDAwIiAvPgogIDxwYXRoIGQ9Ik0xMDAgMTEwIEg0MTIgVjQwMCBMMzgyIDQzMCBIMTAwIFoiIGZpbGw9IndoaXRlIiAvPgogIDx0ZXh0IHg9IjI0NSIgeT0iMjY1IiBmb250LWZhbWlseT0iQXJpYWwgQmxhY2siIGZvbnQtd2VpZ2h0PSI5MDAiIGZvbnQtc2l6ZT0iMTE1IiBmaWxsPSIjZDkwMDAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5QTzwvdGV4dD4KICA8cmVjdCB4PSIxODAiIHk9IjMwIiB3aWR0aD0iMTUyIiBoZWlnaHQ9IjcwIiByeD0iMTUiIGZpbGw9IiM5OTk5OTkiIC8+Cjwvc3ZnPg==";

interface Notification {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
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

  const [initialLoading, setInitialLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'info';
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const loadAttempted = useRef(false);

  useEffect(() => {
    const savedSession = localStorage.getItem('app_session');
    if (savedSession) {
      setUser(JSON.parse(savedSession));
    }
    setAuthChecking(false);
  }, []);

  const handleLogin = () => {
    const savedSession = localStorage.getItem('app_session');
    if (savedSession) {
      setUser(JSON.parse(savedSession));
      showNotify("Selamat Datang!", "success");
    }
  };

  const handleLogout = () => {
    setConfirmDialog({
      show: true,
      title: 'Logout',
      message: 'Apakah Anda yakin ingin keluar dari aplikasi?',
      type: 'danger',
      onConfirm: () => {
        localStorage.removeItem('app_session');
        setUser(null);
        showNotify("Berhasil Logout", "info");
        loadAttempted.current = false;
        setState(prev => ({
          ...prev,
          orders: [],
          customers: [],
          products: [],
          categories: [],
          deposits: [],
          activeOrder: null,
          view: 'dashboard',
        }));
        setConfirmDialog(p => ({ ...p, show: false }));
      }
    });
  };

  const showNotify = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setNotification({ message, type });
    if (type !== 'error') setTimeout(() => setNotification(null), 3000);
  }, []);

  const deleteOrderWithRefund = async (id: string) => {
    const order = state.orders.find(o => o.id === id);
    if (!order) return;

    setConfirmDialog({
      show: true,
      title: 'Hapus Order',
      message: `Hapus order ${order.invoiceNumber}? Saldo tabungan akan dikembalikan.`,
      type: 'danger',
      onConfirm: async () => {
        setConfirmDialog(p => ({ ...p, show: false }));
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
      }
    });
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
    if (user && !loadAttempted.current) {
      loadAttempted.current = true;
      loadAllData();
      
      // Safety timeout: stop loading screen after 7 seconds regardless
      const timer = setTimeout(() => {
        setInitialLoading(false);
      }, 7000);
      
      return () => clearTimeout(timer);
    }
  }, [loadAllData, user]);

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

  if (authChecking) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      <span className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Memeriksa Sesi...</span>
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      {!user ? (
        <motion.div
          key="login"
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          <Login onLogin={handleLogin} />
        </motion.div>
      ) : initialLoading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-6 text-center"
        >
          <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl mb-8">
            <img src={`data:image/svg+xml;base64,${APP_LOGO_SVG}`} className="w-16 h-16" />
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-slate-900">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              <span className="text-[10px] font-black tracking-[0.4em] uppercase">Memuat Data Cloud...</span>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans overflow-x-hidden"
        >
          <AnimatePresence>
            {confirmDialog.show && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                  onClick={() => setConfirmDialog(p => ({ ...p, show: false }))}
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden"
                >
                  <div className="p-8 text-center">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-3xl flex items-center justify-center ${
                      confirmDialog.type === 'danger' ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-500'
                    }`}>
                      <AlertCircle size={32} />
                    </div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter mb-2 italic">
                       {confirmDialog.title}
                    </h3>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                      {confirmDialog.message}
                    </p>
                  </div>
                  <div className="flex border-t border-slate-50 p-4 gap-3 bg-slate-50/50">
                    <button 
                      onClick={() => setConfirmDialog(p => ({ ...p, show: false }))}
                      className="flex-1 py-3 px-4 rounded-xl bg-white border border-slate-200 text-slate-500 font-black text-[9px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                    >
                      Batal
                    </button>
                    <button 
                      onClick={confirmDialog.onConfirm}
                      className={`flex-1 py-3 px-4 rounded-xl text-white font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all ${
                        confirmDialog.type === 'danger' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      Ya, Lanjutkan
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {notification && (
              <motion.div 
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-[320px]"
              >
                <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border ${
                  notification.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 
                  notification.type === 'error' ? 'bg-rose-600 border-rose-500 text-white' : 
                  'bg-slate-800 border-slate-700 text-white'
                }`}>
                  {notification.type === 'success' && <CheckCircle2 size={18} />}
                  {notification.type === 'error' && <AlertCircle size={18} />}
                  {notification.type === 'info' && <Info size={18} />}
                  <span className="text-[10px] font-black uppercase tracking-wider flex-1">{notification.message}</span>
                  <button onClick={() => setNotification(null)} className="opacity-50 hover:opacity-100"><X size={14}/></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
              <div className="pt-4 mt-4 border-t border-slate-800/50 space-y-0.5">
                <NavItem icon={<SettingsIcon size={16} />} label="Akun User" active={state.view === 'settings'} onClick={() => setView('settings')} />
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all text-rose-500 hover:text-white hover:bg-rose-600/20"
                >
                  <LogOut size={16} /> <span>Logout</span>
                </button>
              </div>
            </nav>
          </aside>

          <main className="flex-1 h-screen flex flex-col overflow-hidden">
            <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 h-12 flex items-center px-4 md:px-5 sticky top-0 z-30 justify-between">
               <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-slate-600 mr-3"><Menu size={18}/></button>
               <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">{state.view.replace('_', ' ')}</h2>
               <div className="flex items-center gap-2">
                 <button onClick={() => loadAllData(true)} className={`p-2 text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`}><RefreshCw size={14}/></button>
                 <div className="w-px h-4 bg-slate-200 mx-1 hidden md:block"></div>
                 <div className="hidden md:flex flex-col items-end">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter leading-none">Logged in as</span>
                    <span className="text-[9px] font-bold text-slate-700 leading-tight">{user.username}</span>
                 </div>
               </div>
            </header>

            <div className="flex-1 overflow-y-auto no-scrollbar p-3 md:p-4 lg:p-5">
              <div className="max-w-7xl mx-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={state.view + (state.activeOrder?.id || '')}
                    initial={{ opacity: 0, filter: 'blur(8px)', y: 10 }}
                    animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                    exit={{ opacity: 0, filter: 'blur(8px)', y: -10 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    {state.view === 'dashboard' && <Dashboard state={state} onNavigate={setView} />}
                    {state.view === 'settings' && <Settings onNotify={showNotify} />}
                    {state.view === 'manual_invoice' && (
                      <ManualInvoiceManager 
                        products={state.products} 
                        customers={state.customers} 
                        onNotify={showNotify} 
                        onAddOrder={(o) => dbService.upsertOrder(o).then(() => {
                          loadAllData(true);
                          setView('orders');
                        }).catch(e => { showNotify(e.message, "error"); throw e; })}
                      />
                    )}
                    {state.view === 'customers' && (
                      <CustomerManager 
                        customers={state.customers} 
                        onAdd={(c) => dbService.upsertCustomer(c).then(() => { showNotify("Customer Berhasil Ditambah", "success"); loadAllData(true); }).catch(e => showNotify(e.message, "error"))} 
                        onUpdate={(c) => dbService.upsertCustomer(c).then(() => { showNotify("Data Customer Diperbarui", "success"); loadAllData(true); }).catch(e => showNotify(e.message, "error"))} 
                        onDelete={(id) => {
                          setConfirmDialog({
                            show: true,
                            title: 'Hapus Customer',
                            message: 'Apakah Anda yakin ingin menghapus pelanggan ini?',
                            type: 'danger',
                            onConfirm: () => {
                              setConfirmDialog(p => ({ ...p, show: false }));
                              dbService.deleteCustomer(id).then(() => { showNotify("Customer Telah Dihapus", "info"); loadAllData(true); }).catch(e => showNotify(e.message, "error"));
                            }
                          });
                        }} 
                      />
                    )}
                    {state.view === 'products' && (
                      <ProductManager 
                        products={state.products} 
                        categories={state.categories}
                        onAdd={(p) => dbService.upsertProduct(p).then(() => { showNotify("Produk Berhasil Ditambah", "success"); loadAllData(true); }).catch(e => showNotify(e.message, "error"))} 
                        onUpdate={(p) => dbService.upsertProduct(p).then(() => { showNotify("Data Produk Diperbarui", "success"); loadAllData(true); }).catch(e => showNotify(e.message, "error"))} 
                        onDelete={(id) => {
                          setConfirmDialog({
                            show: true,
                            title: 'Hapus Produk',
                            message: 'Apakah Anda yakin ingin menghapus produk ini?',
                            type: 'danger',
                            onConfirm: () => {
                              setConfirmDialog(p => ({ ...p, show: false }));
                              dbService.deleteProduct(id).then(() => { showNotify("Produk Telah Dihapus", "info"); loadAllData(true); }).catch(e => showNotify(e.message, "error"));
                            }
                          });
                        }}
                        onAddCategory={(c) => dbService.upsertCategory(c).then(() => { showNotify("Kategori Ditambah", "success"); loadAllData(true); }).catch(e => showNotify(e.message, "error"))}
                        onDeleteCategory={(id) => {
                          setConfirmDialog({
                            show: true,
                            title: 'Hapus Kategori',
                            message: 'Kategori akan dihapus. Barang di dalamnya tetap ada tapi tanpa kategori.',
                            type: 'danger',
                            onConfirm: () => {
                              setConfirmDialog(p => ({ ...p, show: false }));
                              dbService.deleteCategory(id).then(() => { showNotify("Kategori Dihapus", "info"); loadAllData(true); }).catch(e => showNotify(e.message, "error"));
                            }
                          });
                        }}
                      />
                    )}
                    {state.view === 'orders' && (
                      <OrderManager 
                        state={state} 
                        editingOrderExtern={editingOrder}
                        setEditingOrderExtern={setEditingOrder}
                        onAddOrder={(o) => {
                          setState(prev => ({ ...prev, orders: [o, ...prev.orders] }));
                          return dbService.upsertOrder(o).then(() => loadAllData(true)).catch(e => { showNotify(e.message, "error"); throw e; });
                        }} 
                        onUpdateOrder={(o) => {
                          setState(prev => ({
                            ...prev,
                            orders: prev.orders.map(old => old.id === o.id ? o : old)
                          }));
                          return dbService.upsertOrder(o).then(() => loadAllData(true)).catch(e => { showNotify(e.message, "error"); throw e; });
                        }} 
                        onDeleteOrder={deleteOrderWithRefund} 
                        onUpdateDeposit={(d) => dbService.upsertDeposit(d).then(() => loadAllData(true)).catch(e => { showNotify(e.message, "error"); throw e; })}
                        onViewInvoice={(o) => setState(p => ({...p, activeOrder: o, view: 'invoice_detail', invoiceMode: 'full', lastShipmentQtys: null, lastShipmentDP: null, autoDownloadInvoice: false}))} 
                        onViewShippingInvoice={(o, qtys, dp) => setState(p => ({...p, activeOrder: o, view: 'invoice_detail', invoiceMode: 'shipping', lastShipmentQtys: qtys || null, lastShipmentDP: dp || null, autoDownloadInvoice: false}))}
                        onNotify={showNotify}
                        requestConfirm={(title, message, onConfirm, type) => {
                          setConfirmDialog({
                            show: true,
                            title,
                            message,
                            onConfirm: () => {
                              setConfirmDialog(p => ({ ...p, show: false }));
                              onConfirm();
                            },
                            type
                          });
                        }}
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
                          return dbService.upsertOrder(o).then(() => loadAllData(true)).catch(e => { showNotify(e.message, "error"); throw e; });
                        }} 
                        onAddDeposit={(d) => dbService.upsertDeposit(d).then(() => loadAllData(true)).catch(e => { showNotify(e.message, "error"); throw e; })} 
                        onUpdateDeposit={(d) => dbService.upsertDeposit(d).then(() => loadAllData(true)).catch(e => { showNotify(e.message, "error"); throw e; })}
                        onDeleteDeposit={(id) => {
                          const dep = state.deposits.find(d => d.id === id);
                          const isUsed = dep && dep.usedAmount > 0;
                          setConfirmDialog({
                            show: true,
                            title: 'Hapus Deposit',
                            message: isUsed 
                              ? `Peringatan: Deposit ini sudah terpakai Rp ${dep.usedAmount.toLocaleString()}. Tetap hapus?`
                              : 'Hapus catatan deposit ini?',
                            type: 'danger',
                            onConfirm: () => {
                              setConfirmDialog(p => ({ ...p, show: false }));
                              dbService.deleteDeposit(id).then(() => { showNotify("Deposit Berhasil Dihapus", "info"); loadAllData(true); }).catch(e => showNotify(e.message, "error"));
                            }
                          });
                          return Promise.resolve();
                        }}
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
                          return dbService.upsertOrder(o).then(() => loadAllData(true)).catch(e => { showNotify(e.message, "error"); throw e; });
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
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </main>
          {isMobileMenuOpen && <div className="fixed inset-0 bg-slate-900/40 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const NavItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${active ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
    {icon} <span>{label}</span>
  </button>
);

export default App;