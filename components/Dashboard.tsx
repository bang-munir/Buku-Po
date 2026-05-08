import React, { useMemo } from 'react';
import { 
  ShoppingBag, DollarSign, TrendingUp, 
  ArrowUpRight, Calendar, Wallet, RefreshCw
} from 'lucide-react';
import { AppState, ViewType } from '../types';

interface DashboardProps {
  state: AppState;
  onNavigate: (view: ViewType) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ state, onNavigate }) => {
  
  const stats = useMemo(() => {
    let grossRevenue = 0; // Total Penjualan (Subtotal)
    let unpaidOrderCount = 0; // Nota Belum Lunas
    let totalSoldQty = 0; // Total Produk Terjual
    
    state.orders.forEach(o => {
      grossRevenue += (o.subtotal || 0);
      if ((o.total || 0) > 0) {
        unpaidOrderCount++;
      }
      if (o.items) {
        o.items.forEach(item => {
          totalSoldQty += (item.quantity || 0);
        });
      }
    });

    const availableDeposits = state.deposits.reduce((acc, curr) => acc + (curr.amount - curr.usedAmount), 0);

    return [
      { 
        label: 'Total Penjualan', 
        value: `Rp ${(grossRevenue || 0).toLocaleString()}`, 
        icon: <TrendingUp className="text-white" />, 
        color: 'bg-emerald-600', 
        link: 'reports',
        desc: 'Subtotal kotor'
      },
      { 
        label: 'Nota Belum Lunas', 
        value: `${unpaidOrderCount} Nota`, 
        icon: <DollarSign className="text-white" />, 
        color: 'bg-rose-600', 
        link: 'orders',
        desc: 'Tagihan tertunda'
      },
      { 
        label: 'Tabungan / Sisa DP', 
        value: `Rp ${(availableDeposits || 0).toLocaleString()}`, 
        icon: <Wallet className="text-white" />, 
        color: 'bg-indigo-600', 
        link: 'dp_tracker',
        desc: 'Saldo tersedia'
      },
      { 
        label: 'Produk Terjual', 
        value: `${totalSoldQty.toLocaleString()} Pcs`, 
        icon: <ShoppingBag className="text-white" />, 
        color: 'bg-blue-600', 
        link: 'reports',
        desc: 'Volume penjualan'
      },
    ];
  }, [state.orders, state.deposits]);

  const recentOrders = useMemo(() => [...state.orders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()).slice(0, 5), [state.orders]);

  const productSales = useMemo(() => {
    const salesMap: Record<string, number> = {};
    state.orders.forEach(o => {
      if (o.items) {
        o.items.forEach(item => {
          const name = item.name;
          salesMap[name] = (salesMap[name] || 0) + (item.quantity || 0);
        });
      }
    });
    
    const sorted = Object.entries(salesMap)
      .map(([name, sold]) => ({ name, sold }))
      .sort((a, b) => b.sold - a.sold);
      
    const maxSold = sorted.length > 0 ? sorted[0].sold : 1;
    
    return sorted.slice(0, 4).map(p => ({
      ...p,
      percent: Math.round((p.sold / maxSold) * 100)
    }));
  }, [state.orders]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-16">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">Administrator</p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Selamat Datang!</h1>
          <p className="text-[11px] text-slate-400 font-bold max-w-sm leading-relaxed">Pantau aktivitas operasional dan performa bisnis Anda dalam satu tampilan cerdas.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
             <div className="bg-slate-50 p-2 rounded-xl">
               <Calendar size={14} className="text-slate-400" />
             </div>
             <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest leading-none">
                {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
             </p>
          </div>
          <button 
            onClick={() => onNavigate('manual_invoice')}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-slate-900 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200 transition-all active:scale-95"
          >
            <ShoppingBag size={14} /> Buat Order
          </button>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div 
            key={i} 
            onClick={() => onNavigate(stat.link as ViewType)}
            className="group relative overflow-hidden bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 transition-all hover:shadow-2xl hover:-translate-y-2 cursor-pointer active:scale-[0.98]"
          >
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-slate-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10 space-y-4">
              <div className={`${stat.color} w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg`}>
                {React.cloneElement(stat.icon as React.ReactElement, { size: 18 })}
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{stat.label}</p>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">{stat.value}</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <p className="text-[9px] text-slate-400 font-bold uppercase italic tracking-wider">{stat.desc}</p>
              </div>
            </div>
            <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowUpRight className="text-slate-200 w-8 h-8" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders Table */}
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2.5 rounded-2xl text-white shadow-xl shadow-slate-200">
                <ShoppingBag size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-none">Order Terakhir</h3>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 whitespace-nowrap">Aktivitas real-time</p>
              </div>
            </div>
            <button 
              onClick={() => onNavigate('orders')}
              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all text-[9px] font-black text-indigo-600 uppercase tracking-widest"
            >
              Cek Semua →
            </button>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-6 py-4">Nota</th>
                  <th className="px-6 py-4">Pelanggan</th>
                  <th className="px-6 py-4 text-right">Tagihan</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentOrders.length > 0 ? (
                  recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition-all group text-xs">
                      <td className="px-6 py-4">
                        <p className="font-black text-slate-900 text-sm">{order.invoiceNumber}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-1">
                          {new Date(order.orderDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-black text-slate-700 uppercase tracking-tight truncate max-w-[150px]">{order.customerName}</p>
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-500 text-[7px] font-black uppercase tracking-widest mt-1">
                          {order.customerType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-black text-slate-900">
                          Rp {(order.total || 0).toLocaleString()}
                        </p>
                        {(order.total || 0) <= 0 && <span className="text-[8px] font-black uppercase text-emerald-500 tracking-widest mt-1 block italic opacity-50">Selesai</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                           <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                             order.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                             order.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                             'bg-slate-50 text-slate-400 border-slate-100'
                           }`}>
                             {order.status}
                           </span>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="bg-slate-50 p-4 rounded-full mb-4">
                          <ShoppingBag size={32} className="text-slate-200" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Data Transaksi Kosong</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Insights */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform rotate-12">
               <TrendingUp size={100} />
            </div>
            <div className="relative z-10 space-y-6">
               <div className="space-y-1">
                 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Informasi</p>
                 <h4 className="text-xl font-black tracking-tight">Kinerja Bisnis</h4>
               </div>
               
               <div className="space-y-5">
                  <div className="border-b border-white/10 pb-2 mb-2">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Top Produk Terjual</p>
                  </div>
                  {productSales.length > 0 ? (
                    productSales.map((p, i) => (
                      <InsightItem 
                        key={i}
                        label={p.name} 
                        value={`${p.sold.toLocaleString()} Pcs`} 
                        percent={p.percent} 
                        color={i === 0 ? "bg-emerald-500" : "bg-indigo-500"}
                      />
                    ))
                  ) : (
                    <p className="text-[10px] text-slate-500 italic pb-4">Belum ada data penjualan</p>
                  )}
                  
                  <div className="pt-2 border-t border-white/10 mt-4 flex justify-between items-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Loyalitas Mitra</p>
                    <p className="text-[10px] font-black text-emerald-400">{state.customers.length} Client</p>
                  </div>
               </div>

               <div className="pt-4">
                  <button 
                    onClick={() => onNavigate('reports')}
                    className="w-full bg-white/10 hover:bg-white/20 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all text-center border border-white/10"
                  >
                    Buka Laporan Penuh
                  </button>
               </div>
            </div>
          </div>

          <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-lg overflow-hidden relative">
             <div className="relative z-10 space-y-4">
                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.3em]">Status Sistem</p>
                <div className="flex items-center gap-3">
                   <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                      <RefreshCw size={24} className="animate-spin-slow" />
                   </div>
                   <div>
                      <p className="text-lg font-black leading-none tracking-tight">Berjalan Baik</p>
                      <p className="text-[10px] font-bold text-indigo-200 mt-1 uppercase tracking-widest">Semua data tersinkron</p>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InsightItem = ({ label, value, percent, color }: any) => (
  <div className="space-y-2">
    <div className="flex justify-between items-end">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-xs font-black">{value}</p>
    </div>
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-1000`} style={{ width: `${percent}%` }}></div>
    </div>
  </div>
);

export default Dashboard;