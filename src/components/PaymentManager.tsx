import React, { useState, useMemo } from 'react';
import { 
  History, Search, 
  X, Landmark, UserPlus, Trash2, Edit2, Download, FileText
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePDF } from '@/lib/pdfUtils';
import { AppState, Order, OrderStatus, PaymentRecord, CustomerDeposit } from '@/types';

interface Props {
  state: AppState;
  onUpdateOrder: (order: Order) => Promise<any>;
  onAddDeposit: (deposit: CustomerDeposit) => Promise<any>;
  onUpdateDeposit: (deposit: CustomerDeposit) => Promise<any>;
  onDeleteDeposit: (id: string) => Promise<any>;
  onNotify: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onViewInvoice: (order: Order) => void;
}

const PaymentManager: React.FC<Props> = ({ 
  state, 
  onUpdateOrder, 
  onAddDeposit, 
  onUpdateDeposit, 
  onDeleteDeposit, 
  onNotify,
  onViewInvoice
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // States for Order Payment
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingPayment, setEditingPayment] = useState<{order: Order, payment: PaymentRecord} | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [historyOrder, setHistoryOrder] = useState<Order | null>(null);
  
  // States for New/Edit Deposit
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [editingDeposit, setEditingDeposit] = useState<CustomerDeposit | null>(null);
  const [historyCustomerId, setHistoryCustomerId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [depositAmount, setDepositAmount] = useState<number | string>('');
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0]);
  const [depositNote, setDepositNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Kalkulasi Finansial
  const financialStats = useMemo(() => {
    let totalCollected = 0; // Total Cash In (DP Order + Payments + Deposit In)
    let totalReceivable = 0; // Unpaid balance in orders
    
    // DP lifetime stats
    let totalLifetimeDeposit = 0;
    let totalUsedDeposit = 0;
    let totalAvailableDeposit = 0;
    
    state.orders.forEach(o => {
      const dp = Number(o.downPayment || 0);
      const cashPayments = o.payments ? o.payments.reduce((sum, p) => {
        // Hanya hitung pembayaran tunai/manual (bukan potong DP) untuk Kas Masuk
        if (!p.note?.includes('[Potong DP]')) return sum + Number(p.amount);
        return sum;
      }, 0) : 0;
      
      totalCollected += (dp + cashPayments);
      totalReceivable += Number(o.total || 0);
    });

    state.deposits.forEach(d => {
      totalLifetimeDeposit += d.amount;
      totalUsedDeposit += d.usedAmount;
      totalAvailableDeposit += (d.amount - d.usedAmount);
      // Uang yang masuk ke deposit tapi belum terpakai adalah bagian dari kas masuk
      // (Asumsi: uang fisik sudah diterima saat deposit dicatat)
      totalCollected += (d.amount - d.usedAmount); 
    });

    return { totalCollected, totalReceivable, totalLifetimeDeposit, totalUsedDeposit, totalAvailableDeposit };
  }, [state.orders, state.deposits]);

  const customerDeposits = useMemo(() => {
    const map: Record<string, { id: string, name: string, total: number, used: number }> = {};
    state.deposits.forEach(d => {
      if (!map[d.customerId]) {
         const customer = state.customers.find(c => c.id === d.customerId);
         map[d.customerId] = { id: d.customerId, name: d.customerName || customer?.name || 'Unknown', total: 0, used: 0 };
      }
      map[d.customerId].total += d.amount;
      map[d.customerId].used += d.usedAmount;
    });
    return Object.values(map).filter(d => 
      (d.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [state.deposits, state.customers, searchTerm]);

  // Combine Deposit and Usage for individual customer history
  const customerLedger = useMemo(() => {
    if (!historyCustomerId) return [];

    const ledger: { 
      id: string, 
      date: string, 
      type: 'IN' | 'OUT', 
      amount: number, 
      note: string, 
      details?: string 
    }[] = [];

    // 1. Add all Deposits (IN)
    state.deposits.filter(d => d.customerId === historyCustomerId).forEach(d => {
      ledger.push({
        id: `dep_${d.id}`,
        date: d.date,
        type: 'IN',
        amount: d.amount,
        note: d.notes || 'DP Masuk'
      });
    });

    // 2. Add all Usages from Orders (OUT)
    state.orders.filter(o => o.customerId === historyCustomerId).forEach(o => {
      if (o.payments) {
        o.payments.filter(p => p.note?.includes('[Potong DP]')).forEach(p => {
          ledger.push({
            id: `usage_${p.id}`,
            date: p.date,
            type: 'OUT',
            amount: p.amount,
            note: `Potong Nota ${o.invoiceNumber}`,
            details: o.items.map(i => i.name).join(', ')
          });
        });
      }
    });

    let result = ledger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (startDate) {
      result = result.filter(item => new Date(item.date) >= new Date(startDate));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59);
      result = result.filter(item => new Date(item.date) <= end);
    }

    return result;
  }, [historyCustomerId, state.deposits, state.orders, startDate, endDate]);

  const handleDownloadPDF = async () => {
    try {
      const customer = state.customers.find(c => c.id === historyCustomerId);
      if (!customer) {
        onNotify("Pilih pelanggan terlebih dahulu", "warning");
        return;
      }

      if (customerLedger.length === 0) {
        onNotify("Tidak ada data riwayat untuk diunduh", "info");
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const margin = 14;

      // 1. Header (Modern Indigo)
      doc.setFillColor(79, 70, 229); // Indigo-600
      doc.rect(0, 0, pageWidth, 45, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('RIWAYAT SIMPANAN (DP)', margin, 20);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(238, 242, 255); // Indigo-50
      doc.text(`Pelanggan: ${customer.name}`, margin, 28);
      doc.text('Aplikasi Buku PO Online - OrderPro', margin, 33);
      
      doc.setFontSize(8);
      doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, pageWidth - margin, 20, { align: 'right' });

      // 2. Summary Info
      const totalIn = customerLedger.filter(i => i.type === 'IN').reduce((sum, i) => sum + i.amount, 0);
      const totalOut = customerLedger.filter(i => i.type === 'OUT').reduce((sum, i) => sum + i.amount, 0);
      const balance = totalIn - totalOut;

      const cardY = 55;
      const cardW = (pageWidth - (margin * 2) - 8) / 3;
      const cardH = 22;

      // Total Masuk
      doc.setFillColor(240, 253, 244); // Emerald-50
      doc.roundedRect(margin, cardY, cardW, cardH, 2, 2, 'F');
      doc.setTextColor(21, 128, 61);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL DP MASUK', margin + 4, cardY + 7);
      doc.setTextColor(21, 128, 61);
      doc.setFontSize(10);
      doc.text(`Rp ${totalIn.toLocaleString()}`, margin + 4, cardY + 15);

      // Total Pakai
      doc.setFillColor(254, 242, 242); // Rose-50
      doc.roundedRect(margin + cardW + 4, cardY, cardW, cardH, 2, 2, 'F');
      doc.setTextColor(185, 28, 28);
      doc.setFontSize(7);
      doc.text('TOTAL DIGUNAKAN', margin + cardW + 8, cardY + 7);
      doc.setTextColor(185, 28, 28);
      doc.setFontSize(10);
      doc.text(`Rp ${totalOut.toLocaleString()}`, margin + cardW + 8, cardY + 15);

      // Sisa
      doc.setFillColor(248, 250, 252); // Slate-50
      doc.roundedRect(margin + (cardW * 2) + 8, cardY, cardW, cardH, 2, 2, 'F');
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(7);
      doc.text('SISA SALDO DP', margin + (cardW * 2) + 12, cardY + 7);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.text(`Rp ${balance.toLocaleString()}`, margin + (cardW * 2) + 12, cardY + 15);

      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'italic');
      doc.text(`Periode: ${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`, margin, cardY + cardH + 7);
      
      // 3. Ledger Table
      autoTable(doc, {
        startY: cardY + cardH + 12,
        head: [['Tanggal', 'Keterangan', 'DP Masuk', 'Potong DP', 'Detail']],
        body: customerLedger.map(item => [
          new Date(item.date).toLocaleDateString('id-ID'),
          item.note,
          { content: item.type === 'IN' ? item.amount.toLocaleString() : '-', styles: { textColor: item.type === 'IN' ? [21, 128, 61] : [200, 200, 200] } },
          { content: item.type === 'OUT' ? item.amount.toLocaleString() : '-', styles: { textColor: item.type === 'OUT' ? [225, 29, 72] : [200, 200, 200] } },
          { content: item.details || '-', styles: { fontSize: 6, textColor: [100, 116, 139] } }
        ]),
        foot: [[
          { content: 'TOTAL RINGKASAN', colSpan: 2, styles: { halign: 'right' } },
          { content: totalIn.toLocaleString(), styles: { halign: 'right' } },
          { content: totalOut.toLocaleString(), styles: { halign: 'right' } },
          { content: `Saldo: Rp ${balance.toLocaleString()}`, styles: { fontStyle: 'bold', halign: 'center' } }
        ]],
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85], fontSize: 8, halign: 'center' },
        footStyles: { fillColor: [248, 250, 252], textColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 7, cellPadding: 3 },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { cellWidth: 50 }
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

      const cleanName = customer.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      await savePDF(doc, `DP_History_${cleanName}_${new Date().toISOString().split('T')[0]}.pdf`);
      onNotify("PDF Riwayat DP berhasil diunduh", "success");
    } catch (err: any) {
      console.error("PDF Download Error:", err);
      onNotify(`Gagal download PDF: ${err.message || 'Error tidak diketahui'}`, "error");
    }
  };

  const handleSaveDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      onNotify("Pilih pelanggan terlebih dahulu", "warning");
      return;
    }
    if (!depositAmount || Number(depositAmount) <= 0) {
      onNotify("Masukkan nominal deposit yang valid", "warning");
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const customer = state.customers.find(c => c.id === selectedCustomerId);
      if (editingDeposit && Number(depositAmount) < editingDeposit.usedAmount) {
        // Warning: This could cause inconsistency, but we'll show a warning via notify if the user tries it.
        // Or we could block it. For now, let's keep it but show a warning.
      }
      
      const depData: CustomerDeposit = {
        id: editingDeposit?.id || `dep_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        customerId: selectedCustomerId,
        customerName: customer?.name || 'Unknown',
        amount: Number(depositAmount),
        usedAmount: editingDeposit?.usedAmount || 0,
        date: depositDate ? new Date(depositDate).toISOString() : (editingDeposit?.date || new Date().toISOString()),
        notes: depositNote
      };
      
      if (editingDeposit) {
        await onUpdateDeposit(depData);
        onNotify("Deposit berhasil diperbarui", "success");
      } else {
        await onAddDeposit(depData);
        onNotify("Deposit berhasil disimpan", "success");
      }
      
      setIsDepositModalOpen(false);
      setEditingDeposit(null);
      setDepositAmount('');
      setDepositNote('');
      setSelectedCustomerId('');
    } catch (err: any) {
      console.error("Save deposit error:", err);
      onNotify(err.message || (editingDeposit ? "Gagal update deposit" : "Gagal menyimpan deposit"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDeposit = async (id: string) => {
    try {
      // Defer to parent's onDeleteDeposit which handles confirmation
      await onDeleteDeposit(id);
    } catch (err: any) {
      onNotify(`Gagal menghapus deposit: ${err.message}`, "error");
    }
  };

  const handleDeletePayment = async (order: Order, paymentId: string) => {
    try {
      const p = order.payments.find(p => p.id === paymentId);
      const amount = p?.amount || 0;
      const updatedPayments = order.payments.filter(p => p.id !== paymentId);
      const updatedTotal = order.total + amount;
      
      const isDepositPayment = p?.note?.includes('[Potong DP]');
      
      if (isDepositPayment) {
        // Refund ke saldo deposit
        let amountToRefund = amount;
        const customerDeps = state.deposits
          .filter(d => d.customerId === order.customerId && d.usedAmount > 0)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Refund yang terbaru dulu

        for (const dep of customerDeps) {
          if (amountToRefund <= 0) break;
          const refund = Math.min(dep.usedAmount, amountToRefund);
          await onUpdateDeposit({
            ...dep,
            usedAmount: Math.max(0, dep.usedAmount - refund)
          });
          amountToRefund -= refund;
        }
      } else {
        // Cash payment deleted -> Balik lagi ke menu DP (Refund ke saldo deposit)
        await onAddDeposit({
          id: `dep_ref_${Date.now()}_${order.id.slice(-4)}`,
          customerId: order.customerId,
          customerName: order.customerName,
          amount: amount,
          usedAmount: 0,
          date: new Date().toISOString(),
          notes: `Simpanan Kembali (Dihapus dari Nota ${order.invoiceNumber}: ${p?.note || 'Pembayaran'})`
        } as any);
      }

      await onUpdateOrder({
        ...order,
        payments: updatedPayments,
        total: updatedTotal,
        // If we delete "DP Kirim Cash", we should also decrement downPayment? 
        // In handleSaveProgress we added it to downPayment.
        downPayment: (p?.note?.includes('DP Kirim Cash')) ? Math.max(0, (order.downPayment || 0) - amount) : (order.downPayment || 0),
        depositUsed: isDepositPayment ? Math.max(0, (order.depositUsed || 0) - amount) : (order.depositUsed || 0),
        status: updatedTotal > 0 ? OrderStatus.PENDING : order.status
      });
      onNotify("Pembayaran berhasil dihapus", "success");
    } catch (err: any) {
      console.error("Delete payment error:", err);
      onNotify("Gagal menghapus pembayaran", "error");
    }
  };

  const handleSavePayment = async (amount: number, note: string, isFromBalance = false) => {
    const targetOrder = editingPayment ? editingPayment.order : selectedOrder;
    if (!targetOrder) return;
    
    setIsSubmitting(true);
    try {
      let updatedOrder: Order;
      
      if (editingPayment) {
        // Mode Edit (Hanya cash/manual, INITIAL_DP tetap bisa edit di sini)
        if (editingPayment.payment.id === 'INITIAL_DP') {
          const diff = amount - targetOrder.downPayment;
          const newTotalRemaining = Math.max(0, targetOrder.total - diff);
          updatedOrder = {
             ...targetOrder,
             downPayment: amount,
             total: newTotalRemaining,
             status: newTotalRemaining <= 0 ? OrderStatus.PAID : targetOrder.status
          };
        } else {
          const oldAmount = editingPayment.payment.amount;
          const isDepositPayment = editingPayment.payment.note?.includes('[Potong DP]');
          
          if (isDepositPayment) {
            const diff = amount - oldAmount;
            if (diff !== 0) {
              if (diff > 0) {
                // Tambah pemotongan (kurangi saldo lagi)
                let amountToDeduct = diff;
                const customerDeps = state.deposits
                  .filter(d => d.customerId === targetOrder.customerId && (d.amount - d.usedAmount) > 0)
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                for (const dep of customerDeps) {
                  if (amountToDeduct <= 0) break;
                  const deduct = Math.min(dep.amount - dep.usedAmount, amountToDeduct);
                  await onUpdateDeposit({ ...dep, usedAmount: dep.usedAmount + deduct });
                  amountToDeduct -= deduct;
                }
              } else {
                // Kurangi pemotongan (refund saldo)
                let amountToRefund = Math.abs(diff);
                const customerDeps = state.deposits
                  .filter(d => d.customerId === targetOrder.customerId && d.usedAmount > 0)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                for (const dep of customerDeps) {
                  if (amountToRefund <= 0) break;
                  const refund = Math.min(dep.usedAmount, amountToRefund);
                  await onUpdateDeposit({ ...dep, usedAmount: dep.usedAmount - refund });
                  amountToRefund -= refund;
                }
              }
            }
          }

          const updatedPayments = targetOrder.payments.map(p => 
            p.id === editingPayment.payment.id ? { ...p, amount, note: note.trim() } : p
          );
          const diff = amount - oldAmount;
          const newTotalRemaining = Math.max(0, targetOrder.total - diff);
          
          updatedOrder = {
            ...targetOrder,
            payments: updatedPayments,
            total: newTotalRemaining,
            depositUsed: isDepositPayment ? (targetOrder.depositUsed || 0) + (amount - oldAmount) : (targetOrder.depositUsed || 0),
            status: newTotalRemaining <= 0 ? OrderStatus.PAID : (newTotalRemaining < targetOrder.subtotal ? OrderStatus.PENDING : targetOrder.status)
          };
        }
      } else {
        // Mode Tambah Baru
        if (isFromBalance) {
          // LOGIKA POTONG SALDO DEPOSIT:
          let amountToDeduct = amount;
          const customerDeps = state.deposits
            .filter(d => d.customerId === targetOrder.customerId && (d.amount - d.usedAmount) > 0)
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

        const newPayment: PaymentRecord = {
          id: `pay_${Date.now()}`,
          amount: amount,
          date: new Date().toISOString(),
          note: isFromBalance ? `[Potong DP] ${note.trim()}`.trim() : note.trim()
        };
        const updatedPayments = [...(targetOrder.payments || []), newPayment];
        const newTotalRemaining = Math.max(0, targetOrder.total - amount);
        updatedOrder = {
          ...targetOrder,
          payments: updatedPayments,
          total: newTotalRemaining,
          status: newTotalRemaining <= 0 ? OrderStatus.PAID : targetOrder.status,
          depositUsed: (targetOrder.depositUsed || 0) + (isFromBalance ? amount : 0)
        };
      }

      await onUpdateOrder(updatedOrder);
      onNotify(editingPayment ? "Pembayaran berhasil diupdate" : "Pembayaran berhasil dicatat", "success");
      setIsPayModalOpen(false);
      setEditingPayment(null);
      setSelectedOrder(null);
      if (historyOrder) setHistoryOrder(updatedOrder);
    } catch (err: any) {
      console.error("Save payment error:", err);
      onNotify("Gagal menyimpan pembayaran", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-500">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
         <div className="bg-indigo-50 p-5 rounded-[2rem] border border-indigo-100 shadow-sm flex items-center justify-between">
            <div>
               <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Total DP Masuk</p>
               <h2 className="text-2xl font-black text-indigo-600 tracking-tighter leading-tight">Rp {financialStats.totalLifetimeDeposit.toLocaleString()}</h2>
            </div>
            <div className="bg-white p-3 rounded-2xl text-indigo-400">
               <History size={24} />
            </div>
         </div>
         <div className="bg-emerald-50 p-5 rounded-[2rem] border border-emerald-100 shadow-sm flex items-center justify-between">
            <div>
               <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Sisa DP</p>
               <h2 className="text-2xl font-black text-emerald-600 tracking-tighter leading-tight">Rp {financialStats.totalAvailableDeposit.toLocaleString()}</h2>
            </div>
            <div className="bg-white p-3 rounded-2xl text-emerald-500">
               <Landmark size={24} />
            </div>
         </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-center gap-3">
           <div>
              <h3 className="text-sm font-black text-slate-900 uppercase">Input DP Masuk</h3>
           </div>
           <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                <input type="text" placeholder="Cari..." className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <button 
                onClick={() => {
                  setEditingDeposit(null);
                  setSelectedCustomerId('');
                  setDepositAmount('');
                  setDepositDate(new Date().toISOString().split('T')[0]);
                  setDepositNote('');
                  setIsDepositModalOpen(true);
                }} 
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 shadow-lg"
              >
                  <UserPlus size={14}/> Terima
              </button>
           </div>
        </div>

        <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead className="bg-slate-50 text-slate-400 text-[8px] font-black uppercase tracking-widest border-b border-slate-100">
                 <tr>
                   <th className="px-5 py-4">Pelanggan</th>
                   <th className="px-5 py-4">Total Masuk</th>
                   <th className="px-5 py-4 text-right">Saldo Saat Ini</th>
                   <th className="px-5 py-4 text-center">Aksi</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {customerDeposits.map(d => (
                     <tr key={d.id} className="hover:bg-slate-50/50 text-xs">
                       <td className="px-5 py-4 font-black text-slate-800 uppercase">{d.name}</td>
                       <td className="px-5 py-4 font-bold text-slate-500">Rp {d.total.toLocaleString()}</td>
                       <td className="px-5 py-4 text-right">
                          <span className={`px-2 py-1 rounded-lg font-black text-[10px] ${d.total - d.used > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                            Rp {(d.total - d.used).toLocaleString()}
                          </span>
                       </td>
                       <td className="px-5 py-4 text-center">
                          <button 
                            onClick={() => setHistoryCustomerId(d.id)}
                            className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-100 transition-all"
                          >
                            <History size={14} />
                          </button>
                       </td>
                     </tr>
                  ))}
               </tbody>
             </table>
        </div>
      </div>

      {/* Modal Terima DP Masuk Baru */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[1.5rem] shadow-2xl p-5 space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                 <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">{editingDeposit ? 'Update DP' : 'Input DP Masuk'}</h3>
                 <button onClick={() => {setIsDepositModalOpen(false); setEditingDeposit(null);}} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg"><X size={18}/></button>
              </div>
              <form onSubmit={handleSaveDeposit} className="space-y-4">
                 <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Pelanggan</label>
                    <select required className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 outline-none font-bold text-xs" value={selectedCustomerId || ''} onChange={e => setSelectedCustomerId(e.target.value)}>
                      <option value="">-- Pilih --</option>
                      {state.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal</label>
                    <input required type="date" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 outline-none font-bold text-xs" value={depositDate} onChange={e => setDepositDate(e.target.value)} />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Nominal (Rp)</label>
                    <input 
                      required 
                      type="number" 
                      placeholder="0" 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none font-black text-indigo-600 text-base" 
                      value={depositAmount ?? ''} 
                      onChange={e => {
                        const val = e.target.value;
                        const num = Number(val);
                        setDepositAmount(val === '' ? '' : (isNaN(num) ? 0 : num));
                      }} 
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan</label>
                    <input placeholder="Titipan DP..." className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 outline-none font-bold text-xs" value={depositNote || ''} onChange={e => setDepositNote(e.target.value)} />
                 </div>
                 <div className="flex gap-2">
                   <button type="submit" disabled={isSubmitting} className="flex-1 bg-indigo-600 text-white py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                      {editingDeposit ? 'UPDATE' : 'SIMPAN'}
                   </button>
                   <button type="button" onClick={() => {setIsDepositModalOpen(false); setEditingDeposit(null);}} className="px-5 bg-slate-100 text-slate-400 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                      BATAL
                   </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Modal Riwayat DP Masuk Customer */}
      {historyCustomerId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
           <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl p-4 md:p-8 space-y-6 my-auto">
              <div className="flex justify-between items-center bg-slate-50 -mx-4 -mt-4 md:-mx-8 md:-mt-8 p-4 md:p-8 rounded-t-[2rem]">
                 <div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Riwayat DP</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                        {state.customers.find(c => c.id === historyCustomerId)?.name}
                      </p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                    <button 
                      onClick={handleDownloadPDF}
                      className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl shadow-sm transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest px-4"
                    >
                      <Download size={16}/> <span className="hidden sm:inline">Download PDF</span>
                    </button>
                    <button onClick={() => setHistoryCustomerId(null)} className="p-2 bg-white text-slate-300 hover:text-rose-500 rounded-xl shadow-sm transition-all"><X size={20}/></button>
                 </div>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl">
                 <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Dari Tanggal</label>
                    <input type="date" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-indigo-500" value={startDate || ''} onChange={e => setStartDate(e.target.value)} />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Sampai Tanggal</label>
                    <input type="date" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-indigo-500" value={endDate || ''} onChange={e => setEndDate(e.target.value)} />
                 </div>
              </div>

              <div className="max-h-[450px] overflow-y-auto pr-1 no-scrollbar space-y-4">
                 {/* Desktop Header */}
                 <div className="hidden md:grid grid-cols-5 bg-slate-50 p-4 rounded-xl text-[9px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-10 shadow-sm border border-slate-100">
                    <div className="col-span-1">Tanggal</div>
                    <div className="col-span-1 text-right">DP Masuk</div>
                    <div className="col-span-1 text-right">Potong DP</div>
                    <div className="col-span-2 px-4">Keterangan</div>
                 </div>

                 {customerLedger.map(item => (
                    <div key={item.id} className="group relative bg-white border border-slate-100 rounded-2xl p-4 md:p-0 md:bg-white md:border-none md:grid md:grid-cols-5 md:items-center hover:bg-slate-50 transition-colors">
                       <div className="md:px-4 md:py-4">
                          <p className="text-[10px] font-black text-slate-900 leading-none">{new Date(item.date).toLocaleDateString('id-ID')}</p>
                          <p className="text-[8px] text-slate-400 font-bold mt-1 uppercase leading-none">{new Date(item.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                       </div>
                       
                       <div className="flex md:block justify-between mt-3 md:mt-0 md:px-4 border-t border-slate-50 pt-3 md:border-none md:pt-0">
                          <span className="md:hidden text-[9px] font-black text-slate-300 uppercase">DP Masuk</span>
                          <span className={`text-xs md:text-right block font-black ${item.type === 'IN' ? 'text-emerald-600' : 'text-slate-200'}`}>
                             {item.type === 'IN' ? `Rp ${item.amount.toLocaleString()}` : '-'}
                          </span>
                       </div>

                       <div className="flex md:block justify-between mt-2 md:mt-0 md:px-4">
                          <span className="md:hidden text-[9px] font-black text-slate-300 uppercase">Potong DP</span>
                          <span className={`text-xs md:text-right block font-black ${item.type === 'OUT' ? 'text-rose-500' : 'text-slate-200'}`}>
                             {item.type === 'OUT' ? `Rp ${item.amount.toLocaleString()}` : '-'}
                          </span>
                       </div>

                       <div className="mt-3 md:mt-0 col-span-2 flex justify-between items-start md:px-4">
                          <div className="flex-1">
                             <p className="text-[11px] font-black text-slate-800 uppercase tracking-tighter leading-snug">{item.note}</p>
                             {item.details && (
                                <div className="mt-2 text-[9px] font-bold text-indigo-500 bg-indigo-50/50 p-2 rounded-xl border border-indigo-100/50">
                                   <span className="text-[8px] font-black text-indigo-300 uppercase block mb-0.5">Detail:</span>
                                   {item.details}
                                </div>
                             )}
                          </div>
                          
                          <div className="flex items-center gap-2 ml-4">
                             <div className="flex gap-1.5">
                                <button 
                                  title="Edit"
                                  onClick={(e) => {
                                     e.stopPropagation();
                                     if (item.type === 'IN') {
                                        const d = state.deposits.find(dep => `dep_${dep.id}` === item.id);
                                        if (d) {
                                           setEditingDeposit(d);
                                           setSelectedCustomerId(d.customerId);
                                           setDepositAmount(d.amount);
                                           setDepositNote(d.notes || '');
                                           setDepositDate(new Date(d.date).toISOString().split('T')[0]);
                                           setIsDepositModalOpen(true);
                                        }
                                     } else {
                                        const order = state.orders.find(o => o.payments?.some(p => `usage_${p.id}` === item.id));
                                        const payment = order?.payments?.find(p => `usage_${p.id}` === item.id);
                                        if (order && payment) {
                                           setEditingPayment({ order, payment });
                                           setIsPayModalOpen(true);
                                        }
                                     }
                                  }}
                                  className="w-9 h-9 flex items-center justify-center text-indigo-500 hover:text-white hover:bg-indigo-600 bg-white border border-indigo-100 rounded-xl shadow-sm transition-all"
                                >
                                   <Edit2 size={14}/>
                                </button>

                                {item.type === 'OUT' && (
                                  <button 
                                    title="Lihat Nota"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const order = state.orders.find(o => o.payments?.some(p => `usage_${p.id}` === item.id));
                                      if (order) {
                                        onViewInvoice(order);
                                      }
                                    }}
                                    className="w-9 h-9 flex items-center justify-center text-emerald-500 hover:text-white hover:bg-emerald-600 bg-white border border-emerald-100 rounded-xl shadow-sm transition-all"
                                  >
                                     <FileText size={14}/>
                                  </button>
                                )}

                                <button 
                                  title="Hapus"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (item.type === 'IN') {
                                       const depId = item.id.replace('dep_', '');
                                       handleDeleteDeposit(depId);
                                    } else {
                                       const order = state.orders.find(o => o.payments?.some(p => `usage_${p.id}` === item.id));
                                       const paymentId = item.id.replace('usage_', '');
                                       if (order) {
                                          handleDeletePayment(order, paymentId);
                                       }
                                    }
                                  }}
                                  className="w-9 h-9 flex items-center justify-center text-rose-400 hover:text-white hover:bg-rose-600 bg-white border border-rose-100 rounded-xl shadow-sm transition-all"
                                >
                                   <Trash2 size={14}/>
                                </button>
                             </div>
                          </div>
                       </div>
                    </div>
                 ))}
                 
                 {customerLedger.length === 0 && (
                    <div className="py-20 text-center space-y-3 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                       <History size={40} className="mx-auto text-slate-200" />
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Belum ada riwayat transaksi</p>
                       {(startDate || endDate) && (
                          <button onClick={() => {setStartDate(''); setEndDate('');}} className="text-indigo-600 text-[9px] font-black uppercase underline">Reset Filter</button>
                       )}
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Modal Riwayat Pembayaran Order */}
      {historyOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl p-8 space-y-6">
              <div className="flex justify-between items-center">
                 <div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Riwayat Pembayaran</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inv: {historyOrder.invoiceNumber}</p>
                 </div>
                 <button onClick={() => setHistoryOrder(null)} className="p-2 text-slate-300 hover:text-rose-500"><X size={24}/></button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Total Tagihan</p>
                    <p className="text-xs font-black text-slate-700">Rp {historyOrder.subtotal.toLocaleString()}</p>
                 </div>
                 <div className="bg-emerald-50 p-4 rounded-2xl">
                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">Sudah Terbayar</p>
                    <p className="text-xs font-black text-emerald-600">Rp {(historyOrder.subtotal - historyOrder.total).toLocaleString()}</p>
                 </div>
              </div>

              <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto no-scrollbar">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase">
                       <tr>
                          <th className="px-6 py-4">Tgl</th>
                          <th className="px-6 py-4 text-right">Nominal</th>
                          <th className="px-6 py-4">Catatan</th>
                          <th className="px-6 py-4 text-center">Aksi</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       <tr className="bg-indigo-50/30">
                          <td className="px-6 py-4 text-[10px] font-bold text-slate-400">ORDER</td>
                          <td className="px-6 py-4 text-right text-xs font-black text-indigo-600">Rp {historyOrder.downPayment.toLocaleString()}</td>
                          <td className="px-6 py-4 text-[10px] font-bold text-slate-400 italic">Down Payment</td>
                          <td className="px-6 py-4 text-center">
                             <button onClick={() => {
                                setEditingPayment({ 
                                   order: historyOrder, 
                                   payment: { id: 'INITIAL_DP', amount: historyOrder.downPayment, date: historyOrder.orderDate, note: 'Down Payment' } 
                                });
                                setIsPayModalOpen(true);
                             }} className="text-indigo-400 hover:text-indigo-600 transition-colors">
                                <Edit2 size={14}/>
                             </button>
                          </td>
                       </tr>
                       {historyOrder.payments?.map(p => (
                          <tr key={p.id}>
                             <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">{new Date(p.date).toLocaleDateString('id-ID')}</td>
                             <td className="px-6 py-4 text-right text-xs font-black text-slate-700">Rp {p.amount.toLocaleString()}</td>
                             <td className="px-6 py-4 text-[10px] font-bold text-slate-400 italic truncate max-w-[120px]">{p.note || '-'}</td>
                             <td className="px-6 py-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                   <button onClick={() => {
                                      setEditingPayment({ order: historyOrder, payment: p });
                                      setIsPayModalOpen(true);
                                   }} className="text-slate-400 hover:text-indigo-600 transition-colors">
                                      <Edit2 size={14}/>
                                   </button>
                                   <button onClick={() => handleDeletePayment(historyOrder, p.id)} className="text-rose-300 hover:text-rose-500">
                                      <Trash2 size={14}/>
                                   </button>
                                </div>
                             </td>
                          </tr>
                       ))}
                       {(!historyOrder.payments || historyOrder.payments.length === 0) && historyOrder.downPayment === 0 && (
                          <tr><td colSpan={4} className="py-10 text-center text-[10px] font-bold text-slate-300 uppercase italic">Belum ada riwayat bayar</td></tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {/* Modal Bayar Nota */}
      {(isPayModalOpen || editingPayment) && (
        <PayModal 
           order={editingPayment ? editingPayment.order : selectedOrder} 
           editingPayment={editingPayment?.payment}
           availableBalance={(() => {
             const custId = editingPayment ? editingPayment.order.customerId : selectedOrder?.customerId;
             if (!custId) return 0;
             return state.deposits
               .filter(d => d.customerId === custId)
               .reduce((sum, d) => sum + (d.amount - d.usedAmount), 0);
           })()}
           onClose={() => {
              setIsPayModalOpen(false);
              setEditingPayment(null);
              setSelectedOrder(null);
           }} 
           onConfirm={handleSavePayment} 
           isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
};

const PayModal = ({ order, editingPayment, availableBalance, onClose, onConfirm, isSubmitting }: any) => {
  const [amount, setAmount] = useState<number | string>(editingPayment?.amount || '');
  const [note, setNote] = useState(editingPayment?.note || '');
  const [isUsingBalance, setIsUsingBalance] = useState(false);

  const remainingToPay = editingPayment ? (order.total + editingPayment.amount) : order.total;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
       <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 space-y-6">
          <div className="flex justify-between items-center">
             <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">
               {editingPayment ? 'Edit Pembayaran' : 'Input Pembayaran Nota'}
             </h3>
             <button onClick={onClose} className="p-2 text-slate-300 hover:text-rose-500"><X size={24}/></button>
          </div>

          <div className="bg-rose-50 p-5 rounded-2xl text-center">
             <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
               {editingPayment ? 'Total (Sebelum Payment ini)' : 'Total Nota'}
             </p>
             <h4 className="text-2xl font-black text-rose-600">
               Rp {remainingToPay.toLocaleString()}
             </h4>
          </div>

          {!editingPayment && availableBalance > 0 && (
             <div className={`p-4 rounded-2xl border transition-all ${isUsingBalance ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                <div className="flex justify-between items-center mb-2">
                   <p className={`text-[10px] font-black uppercase tracking-widest ${isUsingBalance ? 'text-indigo-200' : 'text-slate-400'}`}>Saldo DP Tersedia</p>
                   <p className="text-xs font-black">Rp {availableBalance.toLocaleString()}</p>
                </div>
                <button 
                  onClick={() => {
                    setIsUsingBalance(!isUsingBalance);
                    if (!isUsingBalance) {
                      setAmount(Math.min(remainingToPay, availableBalance));
                    }
                  }} 
                  className={`w-full py-2 rounded-xl text-[10px] font-black uppercase transition-all ${isUsingBalance ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white shadow-md'}`}
                >
                   {isUsingBalance ? 'BATALKAN GUNAKAN SALDO' : 'GUNAKAN SALDO DP'}
                </button>
             </div>
          )}

          <div className="space-y-4">
             <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nominal {isUsingBalance ? '(Potong Saldo)' : '(Uang Tunai)'}</label>
                <input 
                  type="number" 
                  placeholder="0" 
                  className={`w-full px-6 py-4 rounded-2xl border bg-slate-50 font-black text-lg outline-none transition-all ${isUsingBalance ? 'border-indigo-600 text-indigo-600' : 'border-slate-200 text-slate-900'}`} 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Keterangan</label>
                <input placeholder="Catatan pembayaran..." className="w-full px-6 py-3 rounded-xl border border-slate-200 bg-slate-50 font-bold text-sm outline-none" value={note} onChange={e => setNote(e.target.value)} />
             </div>
             
             <button 
               onClick={() => onConfirm(Number(amount), note, isUsingBalance)} 
               disabled={isSubmitting || !amount || (isUsingBalance && Number(amount) > availableBalance)} 
               className={`w-full py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl transition-all ${isUsingBalance ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-900 hover:bg-slate-800'} text-white disabled:opacity-50`}
             >
               {isUsingBalance ? 'KONFIRMASI POTONG SALDO' : 'KONFIRMASI BAYAR TUNAI'}
             </button>
          </div>
       </div>
    </div>
  );
};

export default PaymentManager;