import React, { useMemo, useState, useRef } from 'react';
import { AppState } from '../types';
import { 
  Trophy, Search, FileText, Image as ImageIcon, 
  PieChart, TrendingUp, Users, Eye, Edit, Trash2, ChevronRight
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePDF } from '../lib/pdfUtils';

interface ReportsProps {
  state: AppState;
  onViewInvoice: (order: any) => void;
  onDeleteOrder: (id: string) => void;
  setEditingOrderExtern: (order: any) => void;
  setView: (view: any) => void;
}

const Reports: React.FC<ReportsProps> = ({ state, onViewInvoice, onDeleteOrder, setEditingOrderExtern, setView }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'SHIPPED_COMPLETED'>('ALL');

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const formatDate = (date: Date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  };

  const setPreset = (type: 'today' | 'week' | 'month' | 'year') => {
    const end = new Date();
    const start = new Date();
    if (type === 'today') start.setHours(0,0,0,0);
    else if (type === 'week') start.setDate(end.getDate() - 7);
    else if (type === 'month') start.setMonth(end.getMonth() - 1);
    else if (type === 'year') start.setFullYear(end.getFullYear() - 1);
    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
  };

  const filteredOrders = useMemo(() => {
    return state.orders.filter(order => {
      const orderDate = new Date(order.orderDate);
      orderDate.setHours(0, 0, 0, 0);
      let matchesTime = true;
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        matchesTime = matchesTime && orderDate >= start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchesTime = matchesTime && orderDate <= end;
      }
      const matchesCustomer = filterCustomer === 'all' || order.customerId === filterCustomer;
      const matchesStatus = filterStatus === 'ALL' || 
        (filterStatus === 'SHIPPED_COMPLETED' && (order.status === 'SHIPPED' || order.status === 'COMPLETED')) ||
        order.status === filterStatus;
      const searchLower = searchTerm.toLowerCase().trim();
      const matchesSearch = searchTerm === '' || 
        (order.customerName || '').toLowerCase().includes(searchLower) || 
        (order.invoiceNumber || '').toLowerCase().includes(searchLower);
      return matchesTime && matchesCustomer && matchesStatus && matchesSearch;
    });
  }, [state.orders, startDate, endDate, filterCustomer, filterStatus, searchTerm]);

  const stats = useMemo(() => {
    let revenue = 0;
    let paid = 0;
    let remaining = 0;
    filteredOrders.forEach(o => {
      const dp = o.downPayment || 0;
      const subtotal = o.subtotal || 0;
      revenue += subtotal;
      paid += dp;
      remaining += (subtotal - dp);
    });
    return {
      totalRevenue: revenue,
      totalPaid: paid,
      totalRemaining: remaining,
      orderCount: filteredOrders.length
    };
  }, [filteredOrders]);

  const periodicOmzet = useMemo(() => {
    const now = new Date();
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let weekRev = 0;
    let monthRev = 0;
    let yearRev = 0;

    state.orders.forEach(o => {
      const d = new Date(o.orderDate);
      if (d >= startOfWeek) weekRev += (o.subtotal || 0);
      if (d >= startOfMonth) monthRev += (o.subtotal || 0);
      if (d >= startOfYear) yearRev += (o.subtotal || 0);
    });

    return { weekRev, monthRev, yearRev };
  }, [state.orders]);

  const productSales = useMemo(() => {
    const salesMap: Record<string, { name: string, qty: number }> = {};
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        if (!salesMap[item.productId]) salesMap[item.productId] = { name: item.name, qty: 0 };
        salesMap[item.productId].qty += item.quantity;
      });
    });
    return Object.values(salesMap).sort((a, b) => b.qty - a.qty);
  }, [filteredOrders]);

  const handleDownloadJPG = async () => {
    if (!reportRef.current) return;
    try {
      // Create a temporary container for full-width capture
      const originalStyle = reportRef.current.style.width;
      reportRef.current.style.width = '1200px'; 
      
      const canvas = await html2canvas(reportRef.current, { 
        scale: 3, 
        backgroundColor: '#f8fafc',
        useCORS: true,
        logging: false
      });
      
      reportRef.current.style.width = originalStyle;

      const link = document.createElement('a');
      link.download = `Laporan_Omzet_${new Date().getTime()}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } catch (err) {
      console.error("JPG Download Error:", err);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      const margin = 14;

      // 1. Modern Header
      doc.setFillColor(79, 70, 229); // Indigo-600
      doc.rect(0, 0, pageWidth, 45, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('LAPORAN PENJUALAN', margin, 20);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(238, 242, 255); // Indigo-50
      doc.text('Aplikasi Buku PO Online - OrderPro', margin, 28);
      
      // Right side header info
      doc.setFontSize(8);
      doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, pageWidth - margin, 20, { align: 'right' });

      // 2. Summary Cards (Redesigned)
      const cardY = 55;
      const cardW = (pageWidth - (margin * 2) - 8) / 3;
      const cardH = 22;

      // Card 1: Omzet
      doc.setFillColor(248, 250, 252); // Slate-50
      doc.roundedRect(margin, cardY, cardW, cardH, 2, 2, 'F');
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('PENJUALAN KOTOR', margin + 4, cardY + 7);
      doc.setTextColor(15, 23, 42); // Slate-900
      doc.setFontSize(10);
      doc.text(`Rp ${stats.totalRevenue.toLocaleString()}`, margin + 4, cardY + 15);

      // Card 2: Terbayar
      doc.setFillColor(240, 253, 244); // Emerald-50
      doc.roundedRect(margin + cardW + 4, cardY, cardW, cardH, 2, 2, 'F');
      doc.setTextColor(21, 128, 61); // Emerald-700
      doc.setFontSize(7);
      doc.text('TERIMA DP', margin + cardW + 8, cardY + 7);
      doc.setTextColor(21, 128, 61);
      doc.setFontSize(10);
      doc.text(`Rp ${stats.totalPaid.toLocaleString()}`, margin + cardW + 8, cardY + 15);

      // Card 3: Piutang
      doc.setFillColor(254, 242, 242); // Rose-50
      doc.roundedRect(margin + (cardW * 2) + 8, cardY, cardW, cardH, 2, 2, 'F');
      doc.setTextColor(185, 28, 28); // Rose-700
      doc.setFontSize(7);
      doc.text('TOTAL SETELAH POTONG DP', margin + (cardW * 2) + 12, cardY + 7);
      doc.setTextColor(185, 28, 28);
      doc.setFontSize(10);
      doc.text(`Rp ${stats.totalRemaining.toLocaleString()}`, margin + (cardW * 2) + 12, cardY + 15);

      // Info filter
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.setFont('helvetica', 'italic');
      doc.text(`Periode: ${startDate || 'Semua'} s/d ${endDate || 'Sekarang'} | Filter: ${filterStatus} | ${stats.orderCount} Transaksi`, margin, cardY + cardH + 8);

      // 3. Periodic Omzet Section
      const omzetY = 95;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240); // Slate-200
      doc.roundedRect(margin, omzetY, pageWidth - (margin * 2), 20, 2, 2, 'D');
      
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'bold');
      doc.text('RINGKASAN OMZET BERKALA', margin + 5, omzetY + 6);

      const colW = (pageWidth - (margin * 2)) / 3;
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text(`7 Hari: Rp ${periodicOmzet.weekRev.toLocaleString()}`, margin + 5, omzetY + 14);
      doc.text(`30 Hari: Rp ${periodicOmzet.monthRev.toLocaleString()}`, margin + 5 + colW, omzetY + 14);
      doc.text(`Tahun: Rp ${periodicOmzet.yearRev.toLocaleString()}`, margin + 5 + (colW * 2), omzetY + 14);

      // 4. Products Table
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text('LAPORAN PRODUK TERLARIS', margin, 128);

      autoTable(doc, {
        startY: 133,
        head: [['Rank', 'Nama Produk', 'Jumlah Terjual']],
        body: productSales.slice(0, 10).map((p, i) => [
          { content: `#${i + 1}`, styles: { fontStyle: 'bold', textColor: [79, 70, 229] } },
          p.name,
          { content: `${p.qty.toLocaleString()} UNIT`, styles: { fontStyle: 'bold' } }
        ]),
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], fontSize: 9, halign: 'center' },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { halign: 'center', cellWidth: 20 },
          2: { halign: 'right' }
        },
        margin: { left: margin, right: margin }
      });

      // 5. Transaction Table (With better spacing and modern look)
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      
      const tableStartY = (finalY > 240) ? 20 : finalY;
      if (finalY > 240) doc.addPage();
      
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text('DAFTAR RINCIAN TRANSAKSI', margin, tableStartY);

      const totalPenjualan = filteredOrders.reduce((s,o) => s + (o.subtotal || 0), 0);
      const totalPotongan = filteredOrders.reduce((s,o) => s + (o.downPayment || 0), 0);
      const totalSisa = totalPenjualan - totalPotongan;

      autoTable(doc, {
        startY: tableStartY + 5,
        head: [['Tanggal', 'Pelanggan', 'Item', 'Penjualan', 'DP', 'Total']],
        body: filteredOrders.map(o => {
          const deduction = o.downPayment || 0;
          const net = (o.subtotal || 0) - deduction;
          return [
            { content: new Date(o.orderDate).toLocaleDateString('id-ID'), styles: { fontStyle: 'bold' } },
            o.customerName,
            { content: o.items.map(i => `${i.name} (x${i.quantity})`).join(', '), styles: { fontSize: 6, textColor: [100, 116, 139] } },
            (o.subtotal || 0).toLocaleString(),
            deduction > 0 ? deduction.toLocaleString() : '-',
            { content: net.toLocaleString(), styles: { fontStyle: 'bold', textColor: [225, 29, 72] } } // Rose-600
          ];
        }),
        foot: [[
          { content: 'TOTAL TERFILTER', colSpan: 3, styles: { halign: 'right' } },
          totalPenjualan.toLocaleString(),
          totalPotongan.toLocaleString(),
          totalSisa.toLocaleString()
        ]],
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85], fontSize: 8, halign: 'center' },
        footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
        columnStyles: {
          2: { cellWidth: 50 },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' }
        },
        margin: { left: margin, right: margin }
      });

      // Footer with Page Numbers
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth / 2, 287, { align: 'center' });
        doc.text('© OrderPro - Generated Report', margin, 287);
      }

      const dateStr = new Date().toISOString().split('T')[0];
      await savePDF(doc, `Laporan_Penjualan_${dateStr}.pdf`);
    } catch (err) {
      console.error("PDF Generate Error:", err);
    }
  };

  return (
    <div className="space-y-4 pb-20 max-w-6xl mx-auto">
      <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 px-1">
           <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Filter Laporan</h3>
           <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={handleDownloadJPG} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-slate-600 text-[9px] font-black hover:bg-slate-100"><ImageIcon size={12} /> JPG</button>
              <button onClick={handleDownloadPDF} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black hover:bg-indigo-700 shadow-md"><FileText size={12} /> PDF</button>
           </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 border-t border-slate-50 pt-3">
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Rentang</label>
            <div className="flex gap-1">
              {['today', 'week', 'month', 'year'].map(t => (
                <button key={t} onClick={() => setPreset(t as any)} className="flex-1 px-1 py-1 bg-slate-50 border border-slate-100 rounded text-[8px] font-black text-slate-500 uppercase hover:bg-white hover:text-indigo-600">
                  {t === 'today' ? 'HARI INI' : t === 'week' ? '7H' : t === 'month' ? '30H' : '1TH'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Pelanggan</label>
            <select className="w-full px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[9px] font-black text-slate-600 outline-none" value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)}>
              <option value="all">SEMUA</option>
              {state.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
            <select className="w-full px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[9px] font-black text-slate-600 outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
              <option value="ALL">SEMUA STATUS</option>
              <option value="SHIPPED_COMPLETED">TERKIRIM/SELESAI</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Cari Transaksi</label>
            <div className="relative">
              <input type="text" placeholder="Invoice / Nama..." className="w-full pl-8 pr-2 py-1 bg-slate-50 border border-slate-100 rounded text-[9px] font-black text-slate-600 outline-none placeholder:text-slate-300" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
            </div>
          </div>
        </div>
      </div>

      <div ref={reportRef} className="bg-slate-50 p-4 md:p-6 rounded-[2rem] space-y-4 text-slate-900 border border-slate-200">
        <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 border border-slate-100">
           <div>
              <h1 className="text-lg font-black uppercase text-slate-900">Laporan Penjualan</h1>
              <p className="text-indigo-500 text-[8px] font-black uppercase tracking-[0.3em] mt-1">Buku PO Online</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
             <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                  <PieChart size={14}/>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Penjualan</p>
                  <h2 className="text-sm font-black text-slate-900">Rp {stats.totalRevenue.toLocaleString()}</h2>
                </div>
             </div>

             <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
                  <TrendingUp size={14}/>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Terima DP</p>
                  <h2 className="text-sm font-black text-emerald-600">Rp {stats.totalPaid.toLocaleString()}</h2>
                </div>
             </div>

             <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
                  <FileText size={14}/>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Setelah potong Dp</p>
                  <h2 className="text-sm font-black text-rose-600">Rp {stats.totalRemaining.toLocaleString()}</h2>
                </div>
             </div>

             <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
                  <Users size={14}/>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Jumlah Transaksi</p>
                  <h2 className="text-sm font-black text-slate-900">{stats.orderCount} Order</h2>
                </div>
             </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-xl">
           <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-indigo-400" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Ringkasan Omzet Berkala</h3>
           </div>
           <div className="grid grid-cols-3 gap-4">
              <div>
                 <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Minggu Ini</p>
                 <p className="text-sm font-black text-indigo-300">Rp {periodicOmzet.weekRev.toLocaleString()}</p>
              </div>
              <div>
                 <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bulan Ini</p>
                 <p className="text-sm font-black text-emerald-400">Rp {periodicOmzet.monthRev.toLocaleString()}</p>
              </div>
              <div>
                 <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tahun Ini</p>
                 <p className="text-sm font-black text-amber-400">Rp {periodicOmzet.yearRev.toLocaleString()}</p>
              </div>
           </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
           <div className="flex items-center gap-1.5 mb-4">
             <Trophy size={14} className="text-amber-500"/>
             <h3 className="text-[9px] font-black text-slate-800 uppercase tracking-widest">Top Produk</h3>
           </div>
           <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {productSales.slice(0, 5).map((p, i) => (
                <div key={i} className="p-2 rounded-lg border border-slate-100 bg-slate-50/50 text-center">
                   <p className="text-[10px] font-bold text-slate-800 truncate mb-0.5">{p.name}</p>
                   <p className="text-[8px] font-black text-slate-400 uppercase">{p.qty} UNIT</p>
                </div>
              ))}
           </div>
        </div>

      {/* Reports Table/Cards Area */}
      <div className="space-y-4">
        {/* Mobile View (Card-based) */}
        <div className="md:hidden space-y-4">
          {filteredOrders.length > 0 ? (
            filteredOrders.map(order => {
              const isExpanded = expandedOrderId === order.id;
              const deduction = order.downPayment || 0;
              const netTotal = (order.subtotal || 0) - deduction;
              const itemSummary = order.items.map(i => `${i.name} (${i.quantity})`).join(', ');

              return (
                <div 
                  key={order.id} 
                  className={`bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden transition-all ${isExpanded ? 'ring-2 ring-indigo-500/20' : ''}`}
                >
                  <div className="p-5 space-y-4" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">{new Date(order.orderDate).toLocaleDateString('id-ID')}</span>
                          <span className="text-[10px] font-bold text-slate-300">|</span>
                          <span className="text-[9px] font-bold text-slate-400">{order.invoiceNumber}</span>
                        </div>
                        <h3 className="text-sm font-black text-slate-800 mt-1">{order.customerName}</h3>
                      </div>
                      <ChevronRight size={16} className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-90 text-indigo-500' : ''}`} />
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-50">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Penjualan</p>
                        <p className="text-xs font-bold text-slate-600">Rp {order.subtotal.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Akhir</p>
                        <p className="text-xs font-black text-rose-600">Rp {netTotal.toLocaleString()}</p>
                      </div>
                    </div>

                    <p className="text-[9px] text-slate-400 truncate italic" title={itemSummary}>
                      {itemSummary}
                    </p>
                  </div>

                  {/* Actions Bar Mobile */}
                  <div className="flex items-center justify-between px-5 py-3 bg-slate-50/50 border-t border-slate-50">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onViewInvoice(order); }}
                        className="p-2.5 text-indigo-500 bg-white border border-indigo-50 rounded-xl shadow-sm active:scale-90 transition-transform"
                      >
                        <Eye size={14} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingOrderExtern(order);
                          setView('orders');
                        }}
                        className="p-2.5 text-amber-500 bg-white border border-amber-50 rounded-xl shadow-sm active:scale-90 transition-transform"
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteOrder(order.id); }}
                        className="p-2.5 text-rose-500 bg-white border border-rose-50 rounded-xl shadow-sm active:scale-90 transition-transform"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    
                    {deduction > 0 && (
                      <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                        DP: Rp {deduction.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Expanded Item Detail Mobile */}
                  {isExpanded && (
                    <div className="px-5 pb-5 bg-white space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="p-4 rounded-2xl bg-indigo-50/30 border border-indigo-100/50 mt-2">
                        <p className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3">Rincian Barang</p>
                        <div className="space-y-3">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-[10px]">
                              <div>
                                <p className="font-bold text-slate-700">{item.name}</p>
                                <p className="text-slate-400 text-[9px]">{item.quantity} x {item.unitPrice.toLocaleString()}</p>
                              </div>
                              <span className="font-black text-slate-900">Rp {(item.quantity * item.unitPrice).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="bg-white rounded-[2rem] p-12 text-center border border-slate-100 flex flex-col items-center gap-4">
               <div className="p-4 bg-slate-50 rounded-full text-slate-200">
                 <Search size={32} />
               </div>
               <p className="text-xs font-bold text-slate-400 italic">Tidak ada laporan ditemukan</p>
            </div>
          )}
        </div>

        {/* Desktop View (Table Style) */}
        <div className="hidden md:block bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[8px] font-black uppercase tracking-widest border-b border-slate-100">
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Pelanggan</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3 text-right">Penjualan</th>
                  <th className="px-4 py-3 text-right">Potong (DP)</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredOrders.map(order => {
                  const isExpanded = expandedOrderId === order.id;
                  const itemSummary = order.items.map(i => `${i.name} (${i.quantity})`).join(', ');
                  const deduction = order.downPayment || 0;
                  const netTotal = (order.subtotal || 0) - deduction;
                  return (
                    <React.Fragment key={order.id}>
                      <tr 
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className={`cursor-pointer hover:bg-slate-50/50 transition-colors text-[10px] ${isExpanded ? 'bg-indigo-50/30' : ''}`}
                      >
                        <td className="px-4 py-2 font-black text-slate-900">{new Date(order.orderDate).toLocaleDateString('id-ID')}</td>
                        <td className="px-4 py-2 font-bold text-slate-700">{order.customerName}</td>
                        <td className="px-4 py-2 text-slate-500 truncate max-w-[150px]" title={itemSummary}>
                          {itemSummary}
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-slate-600">{(order.subtotal || 0).toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-bold text-emerald-600">{deduction > 0 ? deduction.toLocaleString() : '-'}</td>
                        <td className="px-4 py-2 text-right font-black text-rose-600">{netTotal.toLocaleString()}</td>
                        <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={() => onViewInvoice(order)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Lihat Nota"
                            >
                              <Eye size={12} />
                            </button>
                            <button 
                              onClick={() => {
                                setEditingOrderExtern(order);
                                setView('orders');
                              }}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit size={12} />
                            </button>
                            <button 
                              onClick={() => onDeleteOrder(order.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Hapus"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-white">
                          <td colSpan={7} className="px-4 py-3">
                                <div className="rounded-xl border border-indigo-100 bg-white p-4 shadow-sm">
                                  <h4 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-3 px-1 border-l-2 border-indigo-500 pl-2">Rincian Barang</h4>
                                  <table className="w-full text-left text-[11px]">
                                    <thead>
                                      <tr className="text-slate-500 font-black border-b border-slate-100 text-[9px] uppercase tracking-wider">
                                        <th className="px-2 py-2">Nama Barang</th>
                                        <th className="px-2 py-2 text-right">Harga</th>
                                        <th className="px-2 py-2 text-right">Qty</th>
                                        <th className="px-2 py-2 text-right">Jumlah</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                      {order.items.map((item, idx) => {
                                        const qty = item.quantity;
                                        if (qty <= 0) return null;
                                        return (
                                          <tr key={idx} className="hover:bg-slate-50/50">
                                            <td className="px-2 py-2 font-black text-slate-900">{item.name}</td>
                                            <td className="px-2 py-2 text-right font-medium text-slate-500">{item.unitPrice.toLocaleString()}</td>
                                            <td className="px-2 py-2 text-right font-black text-indigo-600">{qty}</td>
                                            <td className="px-2 py-2 text-right font-black text-slate-900">{(qty * item.unitPrice).toLocaleString()}</td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                    <tfoot>
                                      <tr className="font-black border-t border-slate-100">
                                        <td colSpan={3} className="px-2 py-3 text-right text-slate-400 uppercase text-[8px] tracking-widest">Total Barang</td>
                                        <td className="px-2 py-3 text-right text-slate-900 text-xs">{(order.subtotal || 0).toLocaleString()}</td>
                                      </tr>
                                      { (order.downPayment || 0) > 0 && (
                                        <tr className="font-black">
                                          <td colSpan={3} className="px-2 py-1 text-right text-emerald-500 uppercase text-[8px] tracking-widest">Total Potong (DP)</td>
                                          <td className="px-2 py-1 text-right text-emerald-600 text-xs">{(order.downPayment || 0).toLocaleString()}</td>
                                        </tr>
                                      )}
                                      <tr className="font-black">
                                        <td colSpan={3} className="px-2 py-1 text-right text-rose-500 uppercase text-[8px] tracking-widest">Total</td>
                                        <td className="px-2 py-1 text-right text-rose-600 text-xs">{(order.subtotal - (order.downPayment || 0)).toLocaleString()}</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
              <tfoot className="bg-slate-50 font-black text-[10px]">
                <tr>
                   <td colSpan={3} className="px-4 py-3 text-right text-slate-400 uppercase tracking-widest text-[8px]">Total Terfilter ({filteredOrders.length} Nota)</td>
                   <td className="px-4 py-3 text-right text-slate-900">{(filteredOrders.reduce((s,o) => s + (o.subtotal || 0), 0)).toLocaleString()}</td>
                   <td className="px-4 py-3 text-right text-emerald-600">{(filteredOrders.reduce((s,o) => s + (o.downPayment || 0), 0)).toLocaleString()}</td>
                   <td className="px-4 py-3 text-right text-rose-600">{(filteredOrders.reduce((s,o) => s + ((o.subtotal || 0) - (o.downPayment || 0)), 0)).toLocaleString()}</td>
                   <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
);
};

export default Reports;