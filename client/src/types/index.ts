export type UserRole = "admin" | "cashier";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface Warehouse {
  id: number;
  name: string;
  location: string | null;
  contactPerson: string | null;
  phone: string | null;
  isActive: boolean;
}

export interface StockByWarehouse {
  warehouseId: number;
  warehouseName: string;
  location?: string | null;
  quantity: number;
  reorderLevel: number;
  lowStock: boolean;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  category: string | null;
  brand: string | null;
  mrp: string;
  sellingPrice: string;
  taxPercent: string;
  imageUrl: string | null;
  unit: string;
  stockByWarehouse?: StockByWarehouse[];
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  gstNumber: string | null;
  address: string | null;
}

export type PaymentMode = "cash" | "card" | "upi";

export interface CartLine {
  product: Product;
  qty: number;
  barcodeScanned: string;
  availableAtBillingWarehouse: number;
}

export interface InvoiceItem {
  id: number;
  productId: number;
  product: { id: number; name: string; sku: string };
  barcodeScanned: string | null;
  qty: number;
  mrp: string;
  price: string;
  taxAmount: string;
  lineTotal: string;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  customerId: number | null;
  customer: Customer | null;
  warehouseId: number;
  warehouse: Warehouse;
  subtotal: string;
  taxAmount: string;
  discount: string;
  grandTotal: string;
  paymentMode: PaymentMode;
  status: "draft" | "paid" | "cancelled";
  createdAt: string;
  items: InvoiceItem[];
}
