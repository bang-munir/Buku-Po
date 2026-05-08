import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Image as ImageIcon, FileText, ArrowLeft } from 'lucide-react';
import { Order } from '../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { savePDF } from '../lib/pdfUtils';

interface InvoiceViewProps {
  order: Order;
  mode?: 'full' | 'shipping';
  onNotify?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  sessionQtys?: Record<string, number> | null;
  sessionDP?: number | null;
  onBack?: () => void;
  autoDownload?: boolean;
}

const InvoiceView: React.FC<InvoiceViewProps> = ({ order, mode = 'full', onNotify, sessionQtys, sessionDP, onBack, autoDownload }) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [downloadTriggered, setDownloadTriggered] = useState(false);

  const captureInvoice = useCallback(async () => {
    if (!invoiceRef.current) return null;
    
    // Simpan gaya asli
    const originalStyle = invoiceRef.current.style.cssText;
    const originalScrollY = window.scrollY;
    
    // Siapkan element untuk capture agar rapi dan lebar konsisten
    invoiceRef.current.style.width = '750px'; 
    invoiceRef.current.style.maxWidth = 'none';
    invoiceRef.current.style.borderRadius = '0px';
    invoiceRef.current.style.border = 'none';
    invoiceRef.current.style.boxShadow = 'none';
    invoiceRef.current.style.backgroundColor = '#ffffff';
    
    window.scrollTo(0, 0);

    try {
      const canvas = await html2canvas(invoiceRef.current, { 
        scale: 3, 
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 750,
        windowWidth: 750,
      });
      
      // Kembalikan gaya asli
      invoiceRef.current.style.cssText = originalStyle;
      window.scrollTo(0, originalScrollY);
      return canvas;
    } catch (e) {
      console.error("Capture Error:", e);
      invoiceRef.current.style.cssText = originalStyle;
      window.scrollTo(0, originalScrollY);
      return null;
    }
  }, []);

  const handleDownloadJPG = useCallback(async () => {
    try {
      if (onNotify) onNotify("Menyiapkan Gambar...", "info");
      const canvas = await captureInvoice();
      if (!canvas) throw new Error();

      const url = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.href = url;
      link.download = `NOTA-${order.invoiceNumber}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      if (onNotify) onNotify("Gambar nota berhasil diunduh", "success");
    } catch (e) {
      console.error("JPG Download Error:", e);
      if (onNotify) onNotify("Gagal download gambar", "error");
    }
  }, [captureInvoice, onNotify, order.invoiceNumber]);

  const handleDownloadPDF = useCallback(async () => {
    try {
      if (onNotify) onNotify("Membuat PDF...", "info");
      const canvas = await captureInvoice();
      if (!canvas) throw new Error();

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      await savePDF(pdf, `NOTA-${order.invoiceNumber}.pdf`);

      if (onNotify) onNotify("PDF nota berhasil diunduh", "success");
    } catch (e) {
      console.error("PDF Download Error:", e);
      if (onNotify) onNotify("Gagal download PDF", "error");
    }
  }, [captureInvoice, onNotify, order.invoiceNumber]);

  useEffect(() => {
    if (autoDownload && !downloadTriggered && invoiceRef.current) {
      setTimeout(() => {
        handleDownloadPDF();
        setDownloadTriggered(true);
      }, 800);
    }
  }, [autoDownload, downloadTriggered, handleDownloadPDF]);


  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm sticky top-16 z-20">
            <div className="flex items-center gap-4 px-2">
                {onBack && (
                  <button 
                    onClick={onBack}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all active:scale-95"
                  >
                    <ArrowLeft size={18} />
                  </button>
                )}
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Detail Nota</h3>
            </div>
            <div className="flex gap-2">
                <button onClick={handleDownloadJPG} title="Download Gambar" className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 active:scale-95 transition-all"><ImageIcon size={18} /></button>
                <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-black text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"><FileText size={16} /> DOWNLOAD PDF</button>
            </div>
        </div>

        <div className="overflow-x-auto no-scrollbar py-2 -mx-4 px-4 md:mx-0 md:px-0">
          <div ref={invoiceRef} className="bg-white p-12 text-[#1e293b] shadow-sm mx-auto border border-slate-100" style={{ width: '100%', maxWidth: '700px', borderRadius: '0px' }}>
            {/* Header Nota Based on Image */}
            <div className="flex justify-between items-start mb-4">
               <div>
                  <h1 className="text-4xl font-black tracking-tight text-slate-900 leading-none">NOTA</h1>
                  <p className="text-[11px] font-black tracking-[0.2em] text-slate-400 mt-2 uppercase">{order.invoiceNumber}</p>
               </div>
               <div className="text-right">
                  <p className="text-[10px] font-black tracking-[0.2em] text-slate-300 uppercase mb-1">TANGGAL</p>
                  <p className="text-sm font-black text-slate-800">{new Date(order.orderDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
               </div>
            </div>

            <div className="h-[2px] bg-slate-900 w-full mb-10"></div>

            {/* Pelanggan Section */}
            <div className="mb-12">
               <p className="text-[10px] font-black tracking-[0.2em] text-indigo-500 uppercase mb-2">KEPADA</p>
               <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">{order.customerName}</h2>
            </div>

            {/* Table */}
            <table className="w-full mb-8">
              <thead>
                <tr className="border-y border-slate-300">
                  <th className="py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-900">Deskripsi Barang</th>
                  <th className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-900">Harga</th>
                  <th className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-900">Qty</th>
                  <th className="py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-900">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 border-b border-slate-300">
                {order.items
                  .filter(item => {
                    if (mode === 'full') return item.quantity > 0;
                    const qty = sessionQtys ? (sessionQtys[item.id] || 0) : (item.shippedQuantity || 0);
                    return qty > 0;
                  })
                  .map((item) => {
                    const qty = (mode === 'full') 
                      ? item.quantity 
                      : (sessionQtys ? (sessionQtys[item.id] || 0) : (item.shippedQuantity || 0));
                    return (
                    <tr key={item.id}>
                      <td className="py-6 text-xs font-black text-slate-800 uppercase">
                        {item.name}
                      </td>
                      <td className="py-6 text-center text-[11px] font-bold text-slate-400">
                        @ {item.unitPrice.toLocaleString()}
                      </td>
                      <td className="py-6 text-center text-xs font-black text-slate-800">
                        {qty}
                      </td>
                      <td className="py-6 text-right text-xs font-black text-slate-900">
                        Rp {(qty * item.unitPrice).toLocaleString()}
                      </td>
                    </tr>
                );})}
              </tbody>
            </table>

            {/* Total Section */}
            <div className="flex flex-col items-end pt-4 space-y-6">
               <div className="w-[300px] space-y-2">
                  <div className="flex justify-between items-center py-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
                    <span>Jumlah</span>
                    <span className="text-slate-800 tracking-normal font-black">
                      Rp {(() => {
                        const subTotal = order.items.reduce((sum, i) => {
                          const qty = mode === 'full' 
                            ? i.quantity 
                            : (sessionQtys ? (sessionQtys[i.id] || 0) : (i.shippedQuantity || 0));
                          return sum + (qty * i.unitPrice);
                        }, 0);
                        return subTotal.toLocaleString();
                      })()}
                    </span>
                  </div>

                  {/* Tampilkan Total Terbayar */}
                  {(() => {
                    const totalPaid = mode === 'shipping' ? (sessionDP || 0) : (order.downPayment || 0);
                    
                    return totalPaid > 0 ? (
                      <div className="flex justify-between items-center text-[10px] font-black text-emerald-600 italic">
                        <span>Potong (DP)</span>
                        <span>- {totalPaid.toLocaleString()}</span>
                      </div>
                    ) : null;
                  })()}

                  <div className="h-[2px] bg-slate-800 w-full mt-2"></div>
               </div>

               <div className="flex justify-between items-center w-full">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 italic">Total</span>
                  <span className="text-xl font-black text-indigo-600 tracking-tighter">
                    Rp {(() => {
                      if (mode === 'shipping') {
                        const subTotal = order.items.reduce((sum, item) => {
                          const qty = sessionQtys ? (sessionQtys[item.id] || 0) : (item.shippedQuantity || 0);
                          return sum + (qty * item.unitPrice);
                        }, 0);
                        return (subTotal - (sessionDP || 0)).toLocaleString();
                      }
                      return (order.subtotal - (order.downPayment || 0)).toLocaleString();
                    })()}
                  </span>
               </div>
            </div>

            {/* Note if exists */}
            {order.notes && (
              <div className="mt-12 pt-8 border-t border-slate-50">
                 <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Catatan Pesanan</p>
                 <p className="text-[10px] font-bold text-slate-500 italic max-w-lg leading-relaxed">"{order.notes}"</p>
              </div>
            )}
          </div>
        </div>
      </div>
  );
};

export default InvoiceView;