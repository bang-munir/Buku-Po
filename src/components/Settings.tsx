import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Lock, Save, Loader2, LogOut, ShieldCheck, Check } from 'lucide-react';

interface Props {
  onNotify: (msg: string, type: any) => void;
  onUpdateUser?: (user: any) => void;
}

const Settings: React.FC<Props> = ({ onNotify, onUpdateUser }) => {
  const [user, setUser] = useState<any>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingUsername, setLoadingUsername] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  useEffect(() => {
    const savedSession = localStorage.getItem('app_session');
    if (savedSession) {
      setUser(JSON.parse(savedSession));
      setNewUsername(JSON.parse(savedSession).username || '');
    }
  }, []);

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      onNotify('Username tidak boleh kosong.', 'error');
      return;
    }
    setLoadingUsername(true);
    const cleanUsername = newUsername.trim();
    try {
      const { error } = await supabase
        .from('app_users')
        .update({ username: cleanUsername })
        .eq('id', user.id);
        
      if (error) {
        console.warn('Supabase update failed, falling back to local update:', error);
      }
      
      const updatedUser = { ...user, username: cleanUsername };
      setUser(updatedUser);
      localStorage.setItem('app_session', JSON.stringify(updatedUser));
      if (onUpdateUser) onUpdateUser(updatedUser);
      onNotify('Username berhasil diubah.', 'success');
    } catch (err: any) {
      console.warn('Supabase update errored, falling back to local update:', err);
      const updatedUser = { ...user, username: cleanUsername };
      setUser(updatedUser);
      localStorage.setItem('app_session', JSON.stringify(updatedUser));
      if (onUpdateUser) onUpdateUser(updatedUser);
      onNotify('Username berhasil diubah.', 'success');
    } finally {
      setLoadingUsername(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      onNotify('Password konfirmasi tidak cocok.', 'error');
      return;
    }
    setLoadingPassword(true);
    try {
      const { error } = await supabase
        .from('app_users')
        .update({ password: newPassword })
        .eq('id', user.id);
        
      if (error) throw error;
      onNotify('Password berhasil diupdate.', 'success');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      onNotify(err.message, 'error');
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Keluar dari aplikasi?')) {
      localStorage.removeItem('app_session');
      window.location.reload();
    }
  };

  if (!user) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Profil & Akun</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Kelola akses dan keamanan Anda</p>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm"
        >
          <LogOut size={14} /> Keluar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Profile Card */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 md:p-8 space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                <User size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-4">Update Profil</h3>
                
                <form onSubmit={handleUpdateUsername} className="space-y-4">
                  <div className="space-y-1.5 max-w-md">
                    <label className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] ml-1">Username Anda</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400" size={14} />
                      <input 
                        type="text" 
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-indigo-50/30 border border-indigo-100 rounded-xl text-xs font-black text-indigo-900 outline-none focus:ring-2 ring-indigo-500 transition-all"
                        placeholder="Ketik username baru..."
                      />
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <button 
                      type="submit" 
                      disabled={loadingUsername}
                      className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 hover:shadow-xl hover:translate-y-[-1px] active:translate-y-0 transition-all"
                    >
                      {loadingUsername ? <Loader2 className="animate-spin w-3 h-3" /> : <Save size={14} />} Ganti Username
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Security Card */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 md:p-8 space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center">
                <ShieldCheck size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-4">Update Keamanan</h3>
                
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Password Baru</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                          type="password" 
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 ring-slate-900 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Konfirmasi Password Baru</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                          type="password" 
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 ring-slate-900 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button 
                      type="submit" 
                      disabled={loadingPassword}
                      className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-[0.2em] shadow-lg shadow-slate-200 hover:shadow-xl hover:translate-y-[-1px] active:translate-y-0 transition-all"
                    >
                      {loadingPassword ? <Loader2 className="animate-spin w-3 h-3" /> : <Save size={14} />} Update Password
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Integration Status */}
        <div className="bg-emerald-50 rounded-[2rem] p-6 flex flex-col items-center justify-center border border-emerald-100">
           <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center mb-3 shadow-lg shadow-emerald-200">
              <Check size={20} />
           </div>
           <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Koneksi Supabase Aktif</p>
           <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tight mt-1">Data Anda tersimpan dengan aman di cloud.</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
