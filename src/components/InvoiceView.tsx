import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Image as ImageIcon, FileText, ArrowLeft } from 'lucide-react';
import { Order, Customer } from '@/types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { savePDF } from '@/lib/pdfUtils';

interface InvoiceViewProps {
  order: Order;
  mode?: 'full' | 'shipping';
  onNotify?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  sessionQtys?: Record<string, number> | null;
  sessionDP?: number | null;
  onBack?: () => void;
  autoDownload?: boolean;
  customers?: Customer[];
}

const parseItemNameAndUnit = (fullName: string) => {
  const match = fullName.match(/^(.*)\s+\[([^\]]+)\]$/);
  if (match) {
    return { name: match[1], unit: match[2] };
  }
  return { name: fullName, unit: 'Pcs' };
};

const InvoiceView: React.FC<InvoiceViewProps> = ({ order, mode = 'full', onNotify, sessionQtys, sessionDP, onBack, autoDownload, customers }) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [downloadTriggered, setDownloadTriggered] = useState(false);

  const isSuratJalan = mode === 'shipping' || order.invoiceNumber.startsWith('SJ-');

  const customer = customers?.find(c => c.id === order.customerId || c.name.trim().toLowerCase() === order.customerName.trim().toLowerCase());
  const customerPhone = customer?.email || order.customerEmail || '';

  const getSjMeta = () => {
    let senderName = '';
    let senderPhone = '';
    let remarks = order.notes || '';
    if (order.notes && order.notes.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(order.notes);
        senderName = parsed.senderName || parsed.driver || '';
        senderPhone = parsed.senderPhone || parsed.plate || '';
        remarks = parsed.remarks || '';
      } catch (e) {
        // Ignored
      }
    }
    return { senderName, senderPhone, remarks };
  };

  const sjMeta = getSjMeta();

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
      link.download = `${isSuratJalan ? 'SURAT-JALAN' : 'NOTA'}-${order.invoiceNumber}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      if (onNotify) onNotify(`${isSuratJalan ? 'Surat jalan' : 'Gambar nota'} berhasil diunduh`, "success");
    } catch (e) {
      console.error("JPG Download Error:", e);
      if (onNotify) onNotify("Gagal download gambar", "error");
    }
  }, [captureInvoice, onNotify, order.invoiceNumber, isSuratJalan]);

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
      await savePDF(pdf, `${isSuratJalan ? 'SURAT_JALAN' : 'NOTA'}-${order.invoiceNumber}.pdf`);

      if (onNotify) onNotify(`${isSuratJalan ? 'Surat jalan' : 'PDF nota'} berhasil diunduh`, "success");
    } catch (e) {
      console.error("PDF Download Error:", e);
      if (onNotify) onNotify("Gagal download PDF", "error");
    }
  }, [captureInvoice, onNotify, order.invoiceNumber, isSuratJalan]);

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
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  {isSuratJalan ? 'Pratinjau Surat Jalan' : 'Detail Nota'}
                </h3>
            </div>
            <div className="flex gap-2">
                <button onClick={handleDownloadJPG} title="Download Gambar" className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 active:scale-95 transition-all"><ImageIcon size={18} /></button>
                <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-black text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"><FileText size={16} /> DOWNLOAD PDF</button>
            </div>
        </div>

        <div className="overflow-x-auto no-scrollbar py-2 -mx-4 px-4 md:mx-0 md:px-0">
          <div ref={invoiceRef} className="bg-white p-8 md:p-12 text-slate-900 shadow-sm mx-auto border border-slate-100" style={{ width: '100%', maxWidth: '750px', borderRadius: '0px' }}>
            {isSuratJalan ? (
              /* ================= PHYSICAL SURAT JALAN BOOK STYLE ================= */
              <div className="font-sans text-slate-900 space-y-6">
                
                {/* 1. Header Title Centered */}
                <div className="text-center">
                  <h1 className="text-2xl font-extrabold tracking-[0.15em] border-b-2 border-slate-950 inline-block pb-1">
                    SURAT JALAN
                  </h1>
                  <p className="text-[10px] font-mono font-bold tracking-[0.1em] text-slate-500 mt-1 uppercase">
                    No: {order.invoiceNumber}
                  </p>
                </div>

                {/* 2. Metadata Columns (Left & Right) */}
                <div className="grid grid-cols-2 gap-8 text-[11px] leading-relaxed pt-2">
                  {/* Left Column (Sender Details) */}
                  <div className="space-y-2">
                    <div className="flex">
                      <span className="w-28 font-bold">Nama Pengirim</span>
                      <span className="mr-1">:</span>
                      <span className="flex-1 font-semibold uppercase border-b border-dashed border-slate-400">
                        {sjMeta.senderName || '_______________________'}
                      </span>
                    </div>
                    <div className="flex">
                      <span className="w-28 font-bold">Nomor Hp</span>
                      <span className="mr-1">:</span>
                      <span className="flex-1 font-semibold border-b border-dashed border-slate-400">
                        {sjMeta.senderPhone || '_______________________'}
                      </span>
                    </div>
                  </div>

                  {/* Right Column (Recipient & Date) */}
                  <div className="space-y-2 text-left">
                    <div className="flex">
                      <span className="w-20 font-bold">Tanggal</span>
                      <span className="mr-1">:</span>
                      <span className="flex-1 font-semibold border-b border-dashed border-slate-400">
                        {new Date(order.orderDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex">
                      <span className="w-20 font-bold">Kepada</span>
                      <span className="mr-1">:</span>
                      <span className="flex-1 font-extrabold uppercase border-b border-dashed border-slate-400 text-slate-900">
                        {order.customerName || '_______________________'}
                      </span>
                    </div>
                    <div className="flex">
                      <span className="w-20 font-bold">No. Telp</span>
                      <span className="mr-1">:</span>
                      <span className="flex-1 font-semibold border-b border-dashed border-slate-400 text-slate-900">
                        {customerPhone || '_______________________'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Text Indicator */}
                <p className="text-[10px] italic text-slate-600">
                  Kami kirimkan barang-barang tersebut di bawah ini:
                </p>

                {/* 3. Physical Book Grid Table */}
                <div className="border-2 border-slate-950 rounded-none overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 border-b-2 border-slate-950 text-[10px] font-extrabold tracking-wider uppercase text-slate-900 text-center">
                        <th className="py-2.5 px-3 border-r-2 border-slate-950" style={{ width: '25%' }}>BANYAKNYA</th>
                        <th className="py-2.5 px-3 border-r-2 border-slate-950 text-left" style={{ width: '45%' }}>NAMA BARANG</th>
                        <th className="py-2.5 px-3 text-left" style={{ width: '30%' }}>ALAMAT</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] font-semibold">
                      {(() => {
                        // Get valid items
                        const activeItems = order.items.filter(item => {
                          if (mode === 'full') return item.quantity > 0;
                          const qty = sessionQtys ? (sessionQtys[item.id] || 0) : (item.shippedQuantity || 0);
                          return qty > 0;
                        });

                        // Pad rows to reach at least 7 rows total
                        const minRows = 7;
                        const paddedItems: any[] = [...activeItems];
                        while (paddedItems.length < minRows) {
                          paddedItems.push(null);
                        }

                        return paddedItems.map((item, idx) => {
                          if (item) {
                            const qty = (mode === 'full') 
                              ? item.quantity 
                              : (sessionQtys ? (sessionQtys[item.id] || 0) : (item.shippedQuantity || 0));
                            
                            const parsed = parseItemNameAndUnit(item.name);
                            return (
                              <tr key={item.id || idx} className="h-10 text-center border-b border-slate-200 last:border-b-0">
                                <td className="px-3 border-r-2 border-slate-950 font-black text-xs text-slate-900 whitespace-nowrap">
                                  {qty} {parsed.unit.toUpperCase()}
                                </td>
                                <td className="px-3 border-r-2 border-slate-950 text-left font-bold uppercase text-slate-900">
                                  {parsed.name}
                                </td>
                                <td className="px-3 text-left text-[10px] leading-snug text-slate-700 uppercase">
                                  {idx === 0 ? (order.customerAddress || 'Alamat tidak dicantumkan') : ''}
                                </td>
                              </tr>
                            );
                          } else {
                            return (
                              <tr key={`empty-${idx}`} className="h-10 text-center border-b border-slate-200 last:border-b-0">
                                <td className="px-3 border-r-2 border-slate-950">&nbsp;</td>
                                <td className="px-3 border-r-2 border-slate-950">&nbsp;</td>
                                <td className="px-3">&nbsp;</td>
                              </tr>
                            );
                          }
                        });
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* 4. Indonesian Signature Block (Penerima & Hormat Kami) */}
                <div className="grid grid-cols-2 gap-4 text-center text-[10px] font-bold text-slate-800 pt-8">
                  <div className="space-y-16">
                    <p className="uppercase tracking-[0.05em] text-slate-500">Penerima,</p>
                    <p className="font-bold text-slate-400">( ................................................... )</p>
                  </div>
                  <div className="space-y-16">
                    <p className="uppercase tracking-[0.05em] text-slate-500">Hormat Kami,</p>
                    <p className="font-bold text-slate-400">( ................................................... )</p>
                  </div>
                </div>

                {/* Note if exists */}
                {sjMeta.remarks && (
                  <div className="mt-8 pt-4 border-t border-dashed border-slate-300">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                       Keterangan Pengiriman
                     </p>
                     <p className="text-[10px] font-bold text-slate-600 italic max-w-lg leading-relaxed">"{sjMeta.remarks}"</p>
                  </div>
                )}

              </div>
            ) : (
              /* ================= STANDARD INVOICE / NOTA STYLE ================= */
              <div>
                {/* Header Nota Based on Image */}
                <div className="flex justify-between items-start mb-6">
                   <div>
                      <h1 className="text-4xl font-black tracking-tight text-slate-900 leading-none">
                        NOTA
                      </h1>
                      <p className="text-[11px] font-black tracking-[0.2em] text-slate-400 mt-2 uppercase">{order.invoiceNumber}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-black tracking-[0.2em] text-slate-300 uppercase mb-1">TANGGAL KIRIM</p>
                      <p className="text-sm font-black text-slate-800">{new Date(order.orderDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                   </div>
                </div>

                <div className="h-[2px] bg-slate-900 w-full mb-8"></div>

                {/* Pelanggan Section */}
                 <div className="mb-10">
                    <p className="text-[10px] font-black tracking-[0.2em] text-indigo-500 uppercase mb-2">KEPADA YTH</p>
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
                      .filter(item => item.quantity > 0)
                      .map((item, idx) => {
                        const parsed = parseItemNameAndUnit(item.name);
                        return (
                          <tr key={item.id}>
                            <td className="py-6 text-xs font-black text-slate-800 uppercase">
                              {parsed.name}
                            </td>
                            <td className="py-6 text-center text-[11px] font-bold text-slate-400">
                              @ {item.unitPrice.toLocaleString()}
                            </td>
                            <td className="py-6 text-center text-xs font-black text-slate-800">
                              {item.quantity} {parsed.unit.toUpperCase()}
                            </td>
                            <td className="py-6 text-right text-xs font-black text-slate-900">
                              Rp {(item.quantity * item.unitPrice).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>

                {/* Total / Signatures Section */}
                <div className="flex flex-col items-end pt-4 space-y-6">
                   <div className="w-[300px] space-y-2">
                      <div className="flex justify-between items-center py-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
                        <span>Jumlah</span>
                        <span className="text-slate-800 tracking-normal font-black">
                          Rp {(() => {
                            const subTotal = order.items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
                            return subTotal.toLocaleString();
                          })()}
                        </span>
                      </div>

                      {/* Tampilkan Total Terbayar */}
                      {(() => {
                        const totalPaid = order.downPayment || 0;
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
                        Rp {(order.subtotal - (order.downPayment || 0)).toLocaleString()}
                      </span>
                   </div>
                </div>

                {/* Note if exists */}
                {order.notes && !order.notes.startsWith('{') && (
                  <div className="mt-12 pt-6 border-t border-slate-100">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                       Catatan Pesanan
                     </p>
                     <p className="text-[10px] font-bold text-slate-600 italic max-w-lg leading-relaxed">"{order.notes}"</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
  );
};

export default InvoiceView;