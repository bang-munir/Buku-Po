import React, { useState, useEffect } from 'react';
import { Plus, Box, Trash2, Edit2, X, Wallet, Tag } from 'lucide-react';
import { Product, Category } from '../types';

interface Props {
  products: Product[];
  categories: Category[];
  onAdd: (p: Product) => void;
  onUpdate: (p: Product) => void;
  onDelete: (id: string) => void;
  onAddCategory: (c: Category) => void;
  onDeleteCategory: (id: string) => void;
}

const ProductManager: React.FC<Props> = ({ products, categories, onAdd, onUpdate, onDelete, onAddCategory, onDeleteCategory }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    categoryId: '',
    costPrice: 0,
    priceJakarta: 0, 
    priceLuarKota: 0 
  });

  useEffect(() => {
    if (editingProduct) {
      setFormData({
        name: editingProduct.name || '',
        description: editingProduct.description || '',
        categoryId: editingProduct.categoryId || '',
        costPrice: editingProduct.costPrice || 0,
        priceJakarta: editingProduct.priceJakarta || 0,
        priceLuarKota: editingProduct.priceLuarKota || 0
      });
      setIsFormOpen(true);
    }
  }, [editingProduct]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      onUpdate({ ...editingProduct, ...formData });
    } else {
      const id = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      onAdd({ ...formData, id } as Product);
    }
    resetForm();
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategoryName.trim()) {
      const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      onAddCategory({ id, name: newCategoryName.trim() } as Category);
      setNewCategoryName('');
      setIsCategoryFormOpen(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', categoryId: '', costPrice: 0, priceJakarta: 0, priceLuarKota: 0 });
    setEditingProduct(null);
    setIsFormOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-2 md:p-3 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-sm font-black text-slate-900 uppercase ml-2 flex items-center gap-2">
           <Box size={16} className="text-indigo-600" /> Katalog Barang
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsCategoryFormOpen(true)}
            className="bg-slate-50 text-slate-500 px-3 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest border border-slate-100 hover:bg-slate-100"
          >
            Kategori
          </button>
          <button 
            onClick={() => { resetForm(); setIsFormOpen(true); }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg flex items-center gap-1.5"
          >
            <Plus size={14} /> Barang Baru
          </button>
        </div>
      </div>

      {isCategoryFormOpen && (
        <div className="bg-white p-4 md:p-5 rounded-[1.5rem] shadow-xl border border-slate-100 animate-in slide-in-from-top-4 duration-500 max-w-xl mx-auto w-full space-y-4">
           <div className="flex justify-between items-center border-b border-slate-50 pb-1.5">
             <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">Atur Kategori</h3>
             <button onClick={() => setIsCategoryFormOpen(false)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><X size={18}/></button>
          </div>
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input 
              required 
              placeholder="Nama kategori..."
              className="flex-1 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 focus:bg-white outline-none font-bold text-slate-700 text-xs" 
              value={newCategoryName} 
              onChange={e => setNewCategoryName(e.target.value)} 
            />
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700">OK</button>
          </form>
          <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto no-scrollbar pt-1">
            {categories.map(c => (
              <div key={c.id} className="bg-slate-50/50 border border-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-2 group transition-all hover:border-indigo-100">
                <span className="text-[10px] font-black text-slate-600 uppercase">{c.name}</span>
                <button type="button" onClick={() => onDeleteCategory(c.id)} className="text-slate-300 hover:text-rose-500"><X size={12}/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isFormOpen && (
        <div className="bg-white p-4 md:p-5 rounded-[1.5rem] shadow-xl border border-slate-100 animate-in slide-in-from-top-4 duration-500 max-w-4xl mx-auto w-full space-y-4">
          <div className="flex justify-between items-center border-b border-slate-50 pb-1.5">
             <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">
               {editingProduct ? 'Edit Barang' : 'Input Barang Baru'}
             </h3>
             <button onClick={resetForm} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><X size={18}/></button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-50/50 p-2.5 rounded-xl border border-slate-50">
              <div className="space-y-1 md:col-span-8">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Barang</label>
                <input required className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none font-bold text-slate-800 text-xs shadow-sm" placeholder="Contoh: Jersey Home..." value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-1 md:col-span-4">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Kategori</label>
                <select className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none font-bold text-slate-700 text-[10px] appearance-none shadow-sm" value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})}>
                  <option value="">-- Kategori --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="space-y-1 md:col-span-4">
                <label className="text-[8px] font-black text-rose-500 uppercase tracking-widest ml-1 flex items-center gap-1"><Wallet size={10}/> Modal</label>
                <input 
                  type="number" 
                  placeholder="0" 
                  className="w-full px-3 py-1.5 rounded-lg border border-rose-100 bg-rose-50/30 outline-none font-black text-rose-600 text-xs shadow-sm" 
                  value={formData.costPrice || ''} 
                  onChange={e => {
                    const val = Number(e.target.value);
                    setFormData({...formData, costPrice: isNaN(val) ? 0 : val});
                  }} 
                />
              </div>

              <div className="space-y-1 md:col-span-4">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Jakarta</label>
                <input 
                  required 
                  type="number" 
                  placeholder="0" 
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white outline-none font-black text-slate-800 text-xs shadow-sm" 
                  value={formData.priceJakarta || ''} 
                  onChange={e => {
                    const val = Number(e.target.value);
                    setFormData({...formData, priceJakarta: isNaN(val) ? 0 : val});
                  }} 
                />
              </div>

              <div className="space-y-1 md:col-span-4">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Luar Kota</label>
                <input 
                  required 
                  type="number" 
                  placeholder="0" 
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white outline-none font-black text-slate-800 text-xs shadow-sm" 
                  value={formData.priceLuarKota || ''} 
                  onChange={e => {
                    const val = Number(e.target.value);
                    setFormData({...formData, priceLuarKota: isNaN(val) ? 0 : val});
                  }} 
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-500 font-black text-[9px] uppercase tracking-widest">Batal</button>
              <button type="submit" className="bg-slate-900 text-white px-6 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-indigo-600 shadow-md transition-all">
                {editingProduct ? 'SIMPAN' : 'TAMBAHKAN'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {products.map(p => (
          <div key={p.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 relative group overflow-hidden transition-all hover:shadow-md">
            <div className="flex justify-between items-start mb-3">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <Box size={20} className="text-indigo-500" />
              </div>
              <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingProduct(p); }}
                  className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors"
                  title="Edit Barang"
                >
                  <Edit2 size={15} />
                </button>
                <button 
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(p.id); }}
                  className="p-1.5 text-rose-400 hover:text-rose-600 transition-colors"
                  title="Hapus Barang"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <h4 className="font-bold text-slate-800 text-base mb-1 truncate">{p.name}</h4>
            <div className="flex gap-1 mb-2">
               {p.categoryId && (
                 <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500 text-[9px] font-black uppercase tracking-tighter">
                   <Tag size={9} /> {categories.find(c => c.id === p.categoryId)?.name || 'Kategori'}
                 </span>
               )}
            </div>
            <p className="text-[10px] text-slate-400 mb-3 line-clamp-2 min-h-[28px] font-medium leading-relaxed">{p.description || 'Tidak ada keterangan.'}</p>
            
            <div className="space-y-2 pt-3 border-t border-slate-50 text-[11px]">
               <div className="flex justify-between items-center px-2 py-1 bg-rose-50/50 rounded-lg">
                 <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Modal</span>
                 <span className="font-black text-rose-600">Rp {(p.costPrice || 0).toLocaleString()}</span>
               </div>
               <div className="flex justify-between items-center px-2">
                 <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Jakarta</span>
                 <span className="font-bold text-slate-700">Rp {p.priceJakarta.toLocaleString()}</span>
               </div>
               <div className="flex justify-between items-center px-2">
                 <span className="text-[9px] font-black text-amber-500/60 uppercase tracking-widest">Luar</span>
                 <span className="font-bold text-indigo-600">Rp {p.priceLuarKota.toLocaleString()}</span>
               </div>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <div className="col-span-full py-20 text-center text-slate-400 bg-white rounded-3xl border-2 border-dashed border-slate-100">
            <Box size={40} className="mx-auto mb-3 opacity-10" />
            <p className="text-sm font-bold uppercase tracking-widest opacity-50">Katalog barang masih kosong.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductManager;