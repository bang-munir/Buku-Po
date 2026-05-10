import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Lock, User, ChevronRight, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  onLogin: () => void;
}

const Login: React.FC<Props> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const cleanUsername = username.trim();
      const cleanPassword = password.trim();

      // 1. Coba login langsung
      const { data: userData, error: fetchError } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', cleanUsername)
        .eq('password', cleanPassword)
        .maybeSingle();

      if (fetchError) {
        console.error('DB Error:', fetchError);
        throw new Error('Koneksi ke database bermasalah.');
      }

      if (userData) {
        localStorage.setItem('app_session', JSON.stringify(userData));
        onLogin();
        return;
      }

      // 2. Jika gagal login, cek apakah tabel kosong
      const { count, error: countError } = await supabase
        .from('app_users')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        throw new Error('Gagal mengecek data user. Pastikan tabel app_users sudah dibuat.');
      }

      if (count === 0) {
        // Tabel kosong! Coba buat admin default
        const { error: insError } = await supabase
          .from('app_users')
          .insert([{ username: 'admin', password: '1', full_name: 'Administrator' }]);
        
        if (insError) {
          if (insError.message.includes('row-level security')) {
            throw new Error('RLS Supabase Aktif! Silakan jalankan "ALTER TABLE app_users DISABLE ROW LEVEL SECURITY;" di SQL Editor Supabase.');
          }
          throw new Error(`Gagal membuat user: ${insError.message}`);
        }

        // Coba login lagi jika yang diinput adalah admin/1
        if (cleanUsername === 'admin' && cleanPassword === '1') {
          const { data: retryData } = await supabase
            .from('app_users')
            .select('*')
            .eq('username', 'admin')
            .eq('password', '1')
            .maybeSingle();
          
          if (retryData) {
            localStorage.setItem('app_session', JSON.stringify(retryData));
            onLogin();
            return;
          }
        }
        throw new Error('User admin ("admin"/"1") telah dibuat. Silakan login ulang.');
      }

      throw new Error('Username atau Password yang Anda masukkan salah!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-[#020617] flex items-center justify-center p-4 font-sans overflow-hidden fixed inset-0">
      <div className="w-full max-w-[240px] relative z-10">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/20">
          <div className="p-5 pb-6">
            <div className="flex flex-col items-center mb-4">
              <div className="w-9 h-9 bg-indigo-600 rounded-lg shadow-lg flex items-center justify-center mb-2">
                <Lock className="text-white w-4 h-4" />
              </div>
              <h1 className="text-xs font-black text-slate-900 uppercase tracking-widest text-center">Admin Access</h1>
            </div>

            <form onSubmit={handleAuth} className="space-y-2">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-3 w-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white rounded-lg text-[10px] font-bold outline-none transition-all"
                  placeholder="Username"
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-3 w-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white rounded-lg text-[10px] font-bold outline-none transition-all"
                  placeholder="Password"
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-rose-50 p-2.5 border border-rose-100 rounded-xl flex items-center gap-2 mb-2">
                      <AlertCircle className="text-rose-500 shrink-0" size={12} />
                      <p className="text-[9px] font-black text-rose-600 uppercase tracking-tight leading-tight">{error}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-indigo-600 text-white font-black uppercase tracking-widest text-[8px] py-2.5 rounded-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1 disabled:opacity-50 mt-1"
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Login'}
              </button>
            </form>
          </div>
          <div className="bg-slate-50 p-2 border-t border-slate-100 text-center">
            <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              v1.0 Cloud Module
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
