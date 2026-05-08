import React, { useState } from 'react';
import { AppState, Order, OrderStatus, ViewType } from '../types';
import { Search, Download, FileText, ChevronRight, Printer, User, Edit2, Trash2, RotateCcw } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePDF } from '../lib/pdfUtils';

interface InvoiceBookProps {
  state: AppState;
  onUpdateOrder: (order: Order) => Promise<void>;
  onDeleteOrder: (id: string) => Promise<void>;
  onNotify: (msg: string, type: any) => void;
  onViewInvoice: (order: Order) => void;
  setEditingOrderExtern: (order: Order | null) => void;
  setView: (view: ViewType) => void;
}

const InvoiceBook: React.FC<InvoiceBookProps> = ({ 
  state, 
  onUpdateOrder, 
  onDeleteOrder, 
  onNotify, 
  setEditingOrderExtern,
  setView
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Filter orders that are SHIPPED or COMPLETED (meaning they have been "sent" as invoices)
  const bookOrders = state.orders.filter(order => 
    order.status === 'COMPLETED' || order.status === 'SHIPPED'
  ).sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

  const filteredOrders = bookOrders.filter(order => {
    const matchesSearch = 
      order.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCustomer = filterCustomer === 'all' || order.customerId === filterCustomer;
    return matchesSearch && matchesCustomer;
  });

  const downloadPDF = async (ordersToExport: Order[], title: string) => {
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.width;
    const margin = 14;

    // 1. Header (Modern Indigo)
    doc.setFillColor(79, 70, 229); // Indigo-600
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('BUKU NOTA PENJUALAN', margin, 20);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(238, 242, 255); // Indigo-50
    doc.text(`Kategori: ${title}`, margin, 28);
    doc.text('Aplikasi Buku PO Online - OrderPro', margin, 33);
    
    doc.setFontSize(8);
    doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, pageWidth - margin, 20, { align: 'right' });

    // 2. Summary Cards
    const totalPenjualan = ordersToExport.reduce((s,o) => s + (o.subtotal || 0), 0);
    const totalPotongan = ordersToExport.reduce((s,o) => s + (o.downPayment || 0), 0);
    const totalSisa = totalPenjualan - totalPotongan;

    const cardY = 55;
    const cardW = (pageWidth - (margin * 2) - 8) / 3;
    const cardH = 22;

    // omzet
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, cardY, cardW, cardH, 2, 2, 'F');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL PENJUALAN', margin + 4, cardY + 7);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(`Rp ${totalPenjualan.toLocaleString()}`, margin + 4, cardY + 15);

    // DP
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(margin + cardW + 4, cardY, cardW, cardH, 2, 2, 'F');
    doc.setTextColor(21, 128, 61);
    doc.setFontSize(7);
    doc.text('TOTAL POTONG (DP)', margin + cardW + 8, cardY + 7);
    doc.setTextColor(21, 128, 61);
    doc.setFontSize(10);
    doc.text(`Rp ${totalPotongan.toLocaleString()}`, margin + cardW + 8, cardY + 15);

    // Cash
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(margin + (cardW * 2) + 8, cardY, cardW, cardH, 2, 2, 'F');
    doc.setTextColor(185, 28, 28);
    doc.setFontSize(7);
    doc.text('TOTAL SISA TAGIHAN', margin + (cardW * 2) + 12, cardY + 7);
    doc.setTextColor(185, 28, 28);
    doc.setFontSize(10);
    doc.text(`Rp ${totalSisa.toLocaleString()}`, margin + (cardW * 2) + 12, cardY + 15);

    const tableBody: any[] = [];
    ordersToExport.forEach(o => {
      const deduction = o.downPayment || 0;
      const net = (o.subtotal || 0) - deduction;
      
      // Baris Utama Nota
      tableBody.push([
        { content: o.invoiceNumber, styles: { fontStyle: 'bold', halign: 'center' } },
        o.customerName,
        new Date(o.orderDate).toLocaleDateString('id-ID'),
        { content: (o.subtotal || 0).toLocaleString(), styles: { halign: 'right' } },
        { content: deduction > 0 ? deduction.toLocaleString() : '-', styles: { halign: 'right', textColor: [21, 128, 61] } },
        { content: net.toLocaleString(), styles: { fontStyle: 'bold', halign: 'right', textColor: [225, 29, 72] } }
      ]);

      // Baris Rincian Barang
      const itemsDetail = o.items.map(item => `${item.name} (${item.quantity} x ${item.unitPrice.toLocaleString()})`).join('; ');
      tableBody.push([
        { content: ' RINCIAN:', styles: { fontSize: 6, fontStyle: 'bold', textColor: [79, 70, 229], fillColor: [248, 250, 252] } },
        { content: itemsDetail, colSpan: 5, styles: { fontSize: 6, textColor: [100, 116, 139], fillColor: [248, 250, 252], cellPadding: 2 } }
      ]);
    });

    autoTable(doc, {
      startY: cardY + cardH + 10,
      head: [['Nota', 'Pelanggan', 'Tanggal', 'Penjualan', 'DP', 'Total']],
      body: tableBody,
      foot: [[
        { content: `TOTAL KESELURUHAN (${ordersToExport.length} Nota)`, colSpan: 3, styles: { halign: 'right' } },
        { content: totalPenjualan.toLocaleString(), styles: { halign: 'right' } },
        { content: totalPotongan.toLocaleString(), styles: { halign: 'right' } },
        { content: totalSisa.toLocaleString(), styles: { halign: 'right' } }
      ]],
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85], fontSize: 8, halign: 'center' },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 7, cellPadding: 3 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' }
      }
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

    await savePDF(doc, `BukuNota_${title.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="text-indigo-600" size={24} />
              BUKU NOTA
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 pl-8">Riwayat Penjualan Terkirim</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 lg:min-w-[240px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Cari Nota atau Pelanggan..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="relative min-w-[160px]">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <select
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl text-xs font-black appearance-none focus:ring-2 focus:ring-indigo-500/20"
                value={filterCustomer}
                onChange={(e) => setFilterCustomer(e.target.value)}
              >
                <option value="all text-slate-400">PILIH PELANGGAN</option>
                {state.customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => downloadPDF(filteredOrders, filterCustomer === 'all' ? 'Semua Nota' : state.customers.find(c => c.id === filterCustomer)?.name || 'Pelanggan')}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95"
            >
              <Download size={14} /> Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Main Container for Table/Cards */}
      <div className="space-y-4">
        {/* Mobile View (Card Style) */}
        <div className="md:hidden space-y-4">
          {filteredOrders.length > 0 ? (
            filteredOrders.map(order => {
              const isExpanded = expandedOrderId === order.id;
              const deduction = order.downPayment || 0;
              const totalNet = (order.subtotal || 0) - deduction;

              return (
                <div 
                  key={order.id} 
                  className={`bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden transition-all ${isExpanded ? 'ring-2 ring-indigo-500/20' : ''}`}
                >
                  <div className="p-5 space-y-4" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-indigo-600 uppercase tracking-tighter">{order.invoiceNumber}</span>
                          <span className="text-[10px] font-bold text-slate-300">|</span>
                          <span className="text-[9px] font-bold text-slate-400">{new Date(order.orderDate).toLocaleDateString('id-ID')}</span>
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
                        <p className="text-xs font-black text-rose-600">Rp {totalNet.toLocaleString()}</p>
                      </div>
                    </div>

                    {deduction > 0 && (
                      <div className="flex items-center justify-between text-[9px] bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                        <span className="font-bold text-emerald-700 uppercase tracking-wider">Potongan DP</span>
                        <span className="font-black text-emerald-600">Rp {deduction.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar Mobile */}
                  <div className="flex items-center justify-between px-5 py-3 bg-slate-50/50 border-t border-slate-50">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingOrderExtern(order);
                          setView('orders');
                          setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
                        }}
                        className="p-2.5 text-indigo-500 bg-white border border-indigo-50 rounded-xl shadow-sm active:scale-90 transition-transform"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm("Batal Lunas?")) return;
                          await onUpdateOrder({ ...order, status: OrderStatus.SHIPPED });
                          onNotify("Status dibatalkan", "info");
                        }}
                        className="p-2.5 text-amber-500 bg-white border border-amber-50 rounded-xl shadow-sm active:scale-90 transition-transform"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteOrder(order.id); }}
                        className="p-2.5 text-rose-500 bg-white border border-rose-50 rounded-xl shadow-sm active:scale-90 transition-transform"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadPDF([order], `Nota_${order.invoiceNumber}`);
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md shadow-indigo-100"
                    >
                      <Printer size={12} /> Cetak
                    </button>
                  </div>

                  {/* Expanded Item Detail Mobile */}
                  {isExpanded && (
                    <div className="px-5 pb-5 bg-white space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="p-4 rounded-2xl bg-indigo-50/30 border border-indigo-100/50 mt-2">
                        <p className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3">Daftar Barang</p>
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
              );
            })
          ) : (
            <div className="bg-white rounded-[2rem] p-12 text-center border border-slate-100 flex flex-col items-center gap-4">
               <div className="p-4 bg-slate-50 rounded-full text-slate-200">
                 <Search size={32} />
               </div>
               <p className="text-xs font-bold text-slate-400 italic font-sans px-4">Tidak ada data ditemukan</p>
            </div>
          )}
        </div>

        {/* Desktop View (Table Style) - Hidden on Mobile */}
        <div className="hidden md:block bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4">Nota</th>
                  <th className="px-6 py-4">Tanggal</th>
                  <th className="px-6 py-4">Pelanggan</th>
                  <th className="px-6 py-4 text-right">Potong (DP)</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredOrders.length > 0 ? (
                  filteredOrders.map(order => {
                    const isExpanded = expandedOrderId === order.id;
                    const deduction = order.downPayment || 0;
                    const totalNet = (order.subtotal || 0) - deduction;

                    return (
                      <React.Fragment key={order.id}>
                        <tr className={`hover:bg-indigo-50/20 transition-all cursor-pointer group ${isExpanded ? 'bg-indigo-50/30' : ''}`} onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                               <div className="w-1 h-4 bg-indigo-500 rounded-full opacity-0 group-hover:opacity-100 transition-all" />
                               <span className="text-xs font-black text-slate-900">{order.invoiceNumber}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-[10px] font-bold text-slate-400">{new Date(order.orderDate).toLocaleDateString('id-ID')}</td>
                          <td className="px-6 py-4 font-bold text-slate-700 text-xs">{order.customerName}</td>
                          <td className="px-6 py-4 text-right">
                            {deduction > 0 ? (
                              <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">{deduction.toLocaleString()}</span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-xs font-black text-rose-600">{totalNet.toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingOrderExtern(order);
                                  setView('orders');
                                  setTimeout(() => {
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }, 100);
                                }}
                                className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Edit Nota"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button 
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!confirm("Batalkan status LUNAS? Nota akan kembali ke antrian DIKIRIM.")) return;
                                  try {
                                    await onUpdateOrder({
                                      ...order,
                                      status: OrderStatus.SHIPPED
                                    });
                                    onNotify("Status Lunas dibatalkan", "info");
                                  } catch (err: any) {
                                    onNotify("Gagal: " + err.message, "error");
                                  }
                                }}
                                className="p-1.5 text-amber-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                title="Batal Lunas (Kembalikan ke antrian Kirim)"
                              >
                                <RotateCcw size={13} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteOrder(order.id);
                                }}
                                className="p-1.5 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="Hapus Nota"
                              >
                                <Trash2 size={13} />
                              </button>
                              <div className="w-px h-4 bg-slate-100 mx-1"></div>
                              <button className={`p-2 transition-transform ${isExpanded ? 'rotate-90 text-indigo-600' : 'text-slate-300'}`}>
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-white">
                            <td colSpan={6} className="px-8 py-4">
                              <div className="rounded-3xl border border-indigo-100 bg-indigo-50/20 p-5">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest pl-2 border-l-4 border-indigo-500">Rincian Nota {order.invoiceNumber}</h4>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadPDF([order], `Nota_${order.invoiceNumber}`);
                                    }}
                                    className="p-2 bg-white text-indigo-600 rounded-xl shadow-sm border border-indigo-50 hover:bg-indigo-50 transition-all"
                                    title="Download Nota PDF"
                                  >
                                    <Printer size={14} />
                                  </button>
                                </div>

                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="text-slate-400 font-bold border-b border-indigo-100 text-[10px] uppercase tracking-wider">
                                      <th className="px-2 py-2">Item</th>
                                      <th className="px-2 py-2 text-right">Harga</th>
                                      <th className="px-2 py-2 text-right">Qty</th>
                                      <th className="px-2 py-2 text-right">Jumlah</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {order.items.map((item, idx) => (
                                      <tr key={idx} className="border-b border-indigo-50/50 last:border-0 hover:bg-indigo-50/50 transition-colors">
                                        <td className="px-2 py-2.5 font-bold text-slate-700">{item.name}</td>
                                        <td className="px-2 py-2.5 text-right font-medium text-slate-500">{item.unitPrice.toLocaleString()}</td>
                                        <td className="px-2 py-2.5 text-right font-black text-indigo-600">{item.quantity}</td>
                                        <td className="px-2 py-2.5 text-right font-black text-slate-900">{(item.quantity * item.unitPrice).toLocaleString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="border-t border-indigo-100">
                                    <tr className="font-black">
                                      <td colSpan={3} className="px-2 py-2.5 text-right text-slate-400 uppercase text-[9px] tracking-widest">Subtotal</td>
                                      <td className="px-2 py-2.5 text-right text-slate-900">{(order.subtotal || 0).toLocaleString()}</td>
                                    </tr>
                                    {deduction > 0 && (
                                      <tr className="font-black">
                                        <td colSpan={3} className="px-2 py-2 text-right text-emerald-500 uppercase text-[9px] tracking-widest">
                                          Potong (DP)
                                        </td>
                                        <td className="px-2 py-2 text-right text-emerald-600">-{deduction.toLocaleString()}</td>
                                      </tr>
                                    )}
                                    <tr className="font-black border-t-2 border-indigo-500/10">
                                      <td colSpan={3} className="px-2 py-3 text-right text-slate-900 uppercase text-[10px] tracking-widest">Total</td>
                                      <td className="px-2 py-3 text-right text-rose-600 text-sm">{totalNet.toLocaleString()}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                         <div className="p-5 bg-slate-50 rounded-full">
                            <Search size={24} className="text-slate-300" />
                         </div>
                         <p className="text-xs font-bold text-slate-400 italic">Belum ada nota yang dikirim atau data tidak ditemukan</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceBook;
