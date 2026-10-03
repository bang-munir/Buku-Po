export enum LocationType {
  JAKARTA = 'Jakarta',
  LUAR_KOTA = 'Luar Kota'
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  SHIPPED = 'SHIPPED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface PaymentRecord {
  id: string;
  amount: number;
  date: string;
  note?: string;
}

export interface CustomerDeposit {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  usedAmount: number;
  date: string;
  notes?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Customer {
  id: string;
  name: string;
  address: string;
  type: LocationType;
  email: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId?: string;
  costPrice?: number;
  priceJakarta: number;
  priceLuarKota: number;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  processingQuantity: number; // Jumlah yang sedang dikerjakan
  shippedQuantity: number; 
  unitPrice: number;
  costPrice?: number;
}

// Dokumen resmi hanya dibaca dari Input Surat Jalan (public.surat_jalan /
// public.nota). Buku-Po tidak membuat maupun mengubah isinya.
export interface NotaDocument {
  id: string;
  nomor: string;
  surat_jalan_id: string | null;
  surat_jalan_nomor: string;
  tanggal: string;
  created_at: string;
}

export interface SuratJalanDocument {
  id: string;
  nomor: string;
  tanggal: string;
  created_at: string;
  order_id: string | null;
  invoice_number: string | null;
  nota: NotaDocument[];
}

export interface OrderDocuments {
  surat_jalan: SuratJalanDocument[];
}

export interface Order {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerType: LocationType;
  customerAddress: string;
  orderDate: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  downPayment: number;
  payments: PaymentRecord[];
  total: number;
  notes?: string;
  depositUsed?: number; // Melacak berapa banyak saldo deposit yang dipotong untuk order ini
  documents?: OrderDocuments; // PO -> SJ -> NT (read-only dari Input Surat Jalan)
}

export type ViewType = 'dashboard' | 'customers' | 'products' | 'orders' | 'invoice_detail' | 'reports' | 'manual_invoice' | 'dp_tracker' | 'invoice_book' | 'settings';

export interface AppState {
  orders: Order[];
  customers: Customer[];
  products: Product[];
  categories: Category[];
  deposits: CustomerDeposit[];
  activeOrder: Order | null;
  invoiceMode: 'full' | 'shipping';
  lastShipmentQtys: Record<string, number> | null;
  lastShipmentDP: number | null;
  autoDownloadInvoice?: boolean;
  view: ViewType;
}