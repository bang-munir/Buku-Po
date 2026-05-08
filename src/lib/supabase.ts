
import { createClient } from '@supabase/supabase-js';

// Gunakan Environment Variables jika tersedia, fallback ke kredensial default
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yndmiwxpfkcqsdfpynak.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluZG1pd3hwZmtjcXNkZnB5bmFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0Njc1NzAsImV4cCI6MjA4NjA0MzU3MH0.HhpUUsOtk6dn6YHOjvbvltI9DLBOOiBOTozLMFdlgCE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

export const checkSupabaseConnection = async () => {
  try {
    // 1. Basic auth check (minimal connectivity)
    const { error: authError } = await supabase.auth.getSession();
    if (authError) throw authError;

    // 2. Check if table 'customers' exists as a proxy for schema readiness
    const { error: tableError } = await supabase.from('customers').select('id').limit(1);
    
    if (tableError) {
      if (tableError.code === '42P01') { // Table does not exist
        return { 
          connected: false, 
          isPaused: true, 
          message: `Database terhubung, tapi tabel 'customers' belum ada. Silakan jalankan isi file schema.sql di SQL Editor Supabase Anda.` 
        };
      }
      
      // Handle potential RLS errors
      if (tableError.code === '42501' || tableError.message?.toLowerCase().includes('rls')) {
        return {
          connected: false,
          isPaused: true,
          message: "Akses Ditolak (RLS). Pastikan Anda telah menonaktifkan RLS atau menambahkan Policy di Supabase."
        };
      }
      
      throw tableError;
    }
    
    return { connected: true, isPaused: false, message: "Terhubung ke Supabase Cloud" };
  } catch (err: any) {
    console.error("Supabase Connection Error:", err);
    return { 
      connected: false, 
      isPaused: true, 
      message: "Gagal terhubung ke Supabase. Periksa URL/Key Anda di lib/supabase.ts atau koneksi internet." 
    };
  }
};
