const fs = require('fs');
const filepath = '/app/applet/src/components/OrderManager.tsx';
if (!fs.existsSync(filepath)) {
  console.log('File does not exist: ' + filepath);
  process.exit(1);
}
let content = fs.readFileSync(filepath, 'utf8');

const target = `                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                    <input type="text" placeholder="Nama barang..." className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white outline-none font-bold text-[11px]" value={productSearch} onFocus={() => setShowProductDropdown(true)} onChange={e => setProductSearch(e.target.value)} />
                  </div>
                  {showProductDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                      {state.products.filter(p => (p.name || '').toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                        <button key={p.id} type="button" onClick={() => addProductToItems(p)} className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0 font-bold text-[10px] flex justify-between items-center transition-colors">
                          <span className="text-slate-700">{p.name}</span>
                          <span className="text-[8px] font-black text-indigo-500 uppercase">Rp {(state.customers.find(c => c.id === selectedCustomerId)?.type === LocationType.LUAR_KOTA ? p.priceLuarKota : p.priceJakarta).toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  )}`;

const replacement = `                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                    <input type="text" placeholder="Nama barang..." className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white outline-none font-bold text-[11px]" value={productSearch} onFocus={() => setShowProductDropdown(true)} onChange={e => setProductSearch(e.target.value)} />
                  </div>
                  {showProductDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-100 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                      {state.products.filter(p => (p.name || '').toLowerCase().includes(productSearch.toLowerCase())).map(p => {
                        const orderItem = orderItems.find(oi => oi.productId === p.id);
                        const qtyInOrder = orderItem ? Number(orderItem.qty) || 0 : 0;
                        const price = state.customers.find(c => c.id === selectedCustomerId)?.type === LocationType.LUAR_KOTA ? p.priceLuarKota : p.priceJakarta;
                        return (
                          <button key={p.id} type="button" onClick={() => addProductToItems(p)} className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0 font-bold text-[10px] flex justify-between items-center transition-colors">
                            <span className="text-slate-700 flex items-center gap-1.5">
                              {p.name}
                              {qtyInOrder > 0 && <span className="bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded-full">({qtyInOrder})</span>}
                            </span>
                            <span className="text-[8px] font-black text-indigo-500 uppercase">Rp {price ? price.toLocaleString() : 0}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Quick Catalog Selector */}
                <div className="mt-2 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider ml-1">Pilih Cepat dari Katalog</p>
                    {selectedFormCategory && (
                      <button 
                        type="button" 
                        onClick={() => setSelectedFormCategory('')}
                        className="text-[8px] font-black text-rose-500 uppercase hover:underline"
                      >
                        Reset Kategori
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2.5 max-h-20 overflow-y-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setSelectedFormCategory('')}
                      className={\`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border transition-all \${
                        !selectedFormCategory
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white text-slate-500 border-slate-150 hover:bg-slate-50'
                      }\`}
                    >
                      Semua
                    </button>
                    {state.categories.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedFormCategory(c.id)}
                        className={\`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border transition-all \${
                          selectedFormCategory === c.id
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-slate-500 border-slate-150 hover:bg-slate-50'
                        }\`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-white rounded-xl border border-slate-100">
                    {state.products
                      .filter(p => !selectedFormCategory || p.categoryId === selectedFormCategory)
                      .map(p => {
                        const orderItem = orderItems.find(oi => oi.productId === p.id);
                        const qtyInOrder = orderItem ? Number(orderItem.qty) || 0 : 0;
                        const price = selectedCustomer?.type === LocationType.LUAR_KOTA ? p.priceLuarKota : p.priceJakarta;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => addProductToItems(p)}
                            className={\`p-2 rounded-xl border text-left transition-all flex flex-col justify-between h-14 relative \${
                              qtyInOrder > 0
                                ? 'bg-indigo-50/50 border-indigo-200 shadow-sm'
                                : 'bg-white border-slate-100 hover:bg-slate-50 shadow-sm'
                            }\`}
                          >
                            <div className="flex justify-between items-start w-full gap-1">
                              <span className={\`text-[9px] font-black uppercase truncate \${qtyInOrder > 0 ? 'text-indigo-900' : 'text-slate-700'}\`}>
                                {p.name}
                              </span>
                              {qtyInOrder > 0 && (
                                <span className="bg-indigo-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                                  {qtyInOrder}
                                </span>
                              )}
                            </div>
                            <span className={\`text-[8px] font-black \${qtyInOrder > 0 ? 'text-indigo-600' : 'text-slate-400'}\`}>
                              Rp {price ? price.toLocaleString() : 0}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>`;

const targetNorm = target.replace(/\r?\n/g, '\n');
const contentNorm = content.replace(/\r?\n/g, '\n');

if (contentNorm.includes(targetNorm)) {
  const resultNorm = contentNorm.replace(targetNorm, replacement);
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(filepath, resultNorm.split('\n').join(lineEnding), 'utf8');
  console.log('SUCCESS');
} else {
  console.log('FAIL: Target content not found.');
}
