import React, { useState, useEffect } from 'react';
import { Plus, Users, Trash2, Edit2, X } from 'lucide-react';
import { Customer, LocationType } from '@/types';

interface Props {
  customers: Customer[];
  onAdd: (c: Customer) => void;
  onUpdate: (c: Customer) => void;
  onDelete: (id: string) => void;
}

const CustomerManager: React.FC<Props> = ({ customers, onAdd, onUpdate, onDelete }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', address: '', type: LocationType.JAKARTA });

  useEffect(() => {
    if (editingCustomer) {
      setFormData({
        name: editingCustomer.name || '',
        email: editingCustomer.email || '',
        address: editingCustomer.address || '',
        type: editingCustomer.type || LocationType.JAKARTA
      });
      setIsFormOpen(true);
    }
  }, [editingCustomer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      onUpdate({ ...editingCustomer, ...formData });
    } else {
      const id = `cust_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      onAdd({ ...formData, id } as Customer);
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', address: '', type: LocationType.JAKARTA });
    setEditingCustomer(null);
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-2 md:p-3 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-sm font-black text-slate-900 uppercase ml-2 flex items-center gap-2">
           <Users size={16} className="text-indigo-600" /> Pelanggan
        </h2>
        <button 
          onClick={() => { resetForm(); setIsFormOpen(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg flex items-center gap-1.5"
        >
          <Plus size={14} /> Baru
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white p-4 md:p-5 rounded-[1.5rem] shadow-xl border border-slate-100 animate-in slide-in-from-top-4 duration-500 max-w-3xl mx-auto w-full space-y-4">
          <div className="flex justify-between items-center border-b border-slate-50 pb-1.5">
             <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">
               {editingCustomer ? 'Edit Pelanggan' : 'Input Pelanggan'}
             </h3>
             <button onClick={resetForm} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><X size={18}/></button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/50 p-2.5 rounded-xl border border-slate-50">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama</label>
                <input 
                  required 
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none font-bold text-slate-700 text-xs shadow-sm" 
                  placeholder="Nama..."
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipe Lokasi</label>
                <select 
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none font-bold text-slate-700 text-xs appearance-none shadow-sm" 
                  value={formData.type} 
                  onChange={e => setFormData({...formData, type: e.target.value as LocationType})}
                >
                  <option value={LocationType.JAKARTA}>Jakarta</option>
                  <option value={LocationType.LUAR_KOTA}>Luar Kota</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Tlpn <span className="lowercase font-medium opacity-50">(Opsional)</span></label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none font-bold text-slate-700 text-xs shadow-sm" 
                  placeholder="No. Telepon / Hp..."
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})} 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Alamat</label>
                <input 
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none font-bold text-slate-700 text-xs shadow-sm" 
                  placeholder="Jl. ..."
                  value={formData.address} 
                  onChange={e => setFormData({...formData, address: e.target.value})} 
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button 
                type="button" 
                onClick={resetForm} 
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-500 font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Batal
              </button>
              <button 
                type="submit" 
                className="bg-slate-900 text-white px-6 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-md"
              >
                {editingCustomer ? 'SIMPAN' : 'DAFTARKAN'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {/* Mobile Cards View */}
        <div className="md:hidden space-y-4">
          {customers.length > 0 ? (
            customers.map(c => (
              <div key={c.id} className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden group">
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-sm uppercase shadow-inner">
                      {c.name ? c.name.charAt(0) : '?'}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 leading-tight">{c.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          c.type === LocationType.JAKARTA ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {c.type}
                        </span>
                        {c.email && <span className="text-[9px] text-slate-300 font-bold truncate max-w-[100px]">Tlpn: {c.email}</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setEditingCustomer(c)}
                      className="p-2.5 text-indigo-500 bg-indigo-50/50 rounded-xl active:scale-95 transition-transform"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => onDelete(c.id)}
                      className="p-2.5 text-rose-500 bg-rose-50/50 rounded-xl active:scale-95 transition-transform"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                {c.address && (
                  <div className="px-5 pb-5 pt-0">
                    <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-50/50">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Alamat Lengkap</p>
                      <p className="text-[10px] font-medium text-slate-600 leading-relaxed">{c.address}</p>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="bg-white rounded-[2rem] p-12 text-center border border-slate-100 flex flex-col items-center gap-4">
              <div className="p-4 bg-slate-50 rounded-full text-slate-200">
                <Users size={32} />
              </div>
              <p className="text-xs font-bold text-slate-400 italic">Belum ada pelanggan ditemukan</p>
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-3">Pelanggan</th>
                  <th className="px-5 py-3">Lokasi</th>
                  <th className="px-5 py-3">Alamat</th>
                  <th className="px-5 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-[13px]">
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xs uppercase shrink-0">
                          {c.name ? c.name.charAt(0) : '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate leading-tight">{c.name}</p>
                          {c.email && <p className="text-[9px] text-slate-400 flex items-center gap-1 font-bold truncate tracking-tight uppercase">Tlpn: {c.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                        c.type === LocationType.JAKARTA ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {c.type}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-[11px] font-medium text-slate-400 truncate max-w-[150px]">
                        {c.address || '-'}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingCustomer(c); }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 transition-all"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(c.id); }}
                          className="p-1.5 text-rose-300 hover:text-rose-500 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-slate-400 font-medium italic">
                      Belum ada data pelanggan.
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

export default CustomerManager;