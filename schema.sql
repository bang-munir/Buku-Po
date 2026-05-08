-- SALIN KODE INI KE SQL EDITOR SUPABASE ANDA
-- File: schema.sql
-- Script ini untuk memastikan semua tabel sinkron dengan aplikasi.

-- 1. CLEANUP (Hapus tanda '--' jika ingin RESET TOTAL data agar sinkron 100%)
DROP TABLE IF EXISTS payments, order_items, deposits, orders, products, categories, customers CASCADE;

-- 2. TABEL PELANGGAN
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    email TEXT,
    type TEXT DEFAULT 'Jakarta',
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;

-- 3. TABEL KATEGORI
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;

-- 4. TABEL PRODUK
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    cost_price NUMERIC DEFAULT 0,
    price_jakarta NUMERIC DEFAULT 0,
    price_luar_kota NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE products DISABLE ROW LEVEL SECURITY;

-- 5. TABEL PESANAN (ORDERS)
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
    customer_name TEXT,
    customer_type TEXT,
    customer_address TEXT,
    order_date TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'PENDING',
    subtotal NUMERIC DEFAULT 0,
    down_payment NUMERIC DEFAULT 0,
    deposit_used NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- 6. TABEL ITEM PESANAN
CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT,
    name TEXT NOT NULL,
    quantity INTEGER DEFAULT 0,
    processing_quantity INTEGER DEFAULT 0,
    shipped_quantity INTEGER DEFAULT 0,
    unit_price NUMERIC DEFAULT 0,
    cost_price NUMERIC DEFAULT 0
);
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- 7. TABEL SIMPANAN / DEPOSIT
CREATE TABLE IF NOT EXISTS deposits (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
    customer_name TEXT,
    amount NUMERIC DEFAULT 0,
    used_amount NUMERIC DEFAULT 0,
    date TIMESTAMPTZ DEFAULT now(),
    notes TEXT
);
ALTER TABLE deposits DISABLE ROW LEVEL SECURITY;

-- 8. TABEL RIWAYAT PEMBAYARAN
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    amount NUMERIC DEFAULT 0,
    date TIMESTAMPTZ DEFAULT now(),
    note TEXT
);
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;

-- FIX: Jika tabel sudah ada tapi kolom 'order_date' hilang
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='order_date') THEN
        ALTER TABLE orders ADD COLUMN order_date TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;
