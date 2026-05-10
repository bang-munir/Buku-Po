-- SALIN KODE INI KE SQL EDITOR SUPABASE ANDA
-- File: schema.sql
-- Script ini untuk memastikan semua tabel sinkron dengan aplikasi.

-- 1. EXTENSIONS (Aktifkan UUID jika diperlukan)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CLEANUP (Hapus tanda '--' jika ingin RESET TOTAL data)
-- DROP TABLE IF EXISTS payments, order_items, deposits, orders, products, categories, customers CASCADE;

-- 3. TABEL PELANGGAN
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    email TEXT,
    type TEXT DEFAULT 'Jakarta',
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;

-- 4. TABEL KATEGORI
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;

-- 5. TABEL PRODUK
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
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
ALTER TABLE products DISABLE ROW LEVEL SECURITY;

-- 6. TABEL PESANAN (ORDERS)
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
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- 7. TABEL ITEM PESANAN
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
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- 8. TABEL SIMPANAN / DEPOSIT
CREATE TABLE IF NOT EXISTS deposits (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
    customer_name TEXT,
    amount NUMERIC DEFAULT 0,
    used_amount NUMERIC DEFAULT 0,
    date TIMESTAMPTZ DEFAULT now(),
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_deposits_customer ON deposits(customer_id);
ALTER TABLE deposits DISABLE ROW LEVEL SECURITY;

-- 9. TABEL RIWAYAT PEMBAYARAN
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
    amount NUMERIC DEFAULT 0,
    date TIMESTAMPTZ DEFAULT now(),
    note TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;

-- 10. TABEL USER CUSTOM (Untuk login simpel)
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE app_users DISABLE ROW LEVEL SECURITY;

-- Pastikan user admin ada
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM app_users WHERE username = 'admin') THEN
        INSERT INTO app_users (username, password, full_name) 
        VALUES ('admin', '1', 'Administrator');
    END IF;
END $$;

-- FIX: Menambah kolom jika migrasi diperlukan di tabel lama
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='order_date') THEN
        ALTER TABLE orders ADD COLUMN order_date TIMESTAMPTZ DEFAULT now();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='price_jakarta') THEN
        ALTER TABLE products ADD COLUMN price_jakarta NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='price_luar_kota') THEN
        ALTER TABLE products ADD COLUMN price_luar_kota NUMERIC DEFAULT 0;
    END IF;
END $$;
