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
  damagedQuantity?: number;
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
  isActive?: boolean;
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
  discount: number;
  barcodeScanned: string;
  availableAtBillingWarehouse: number;
}

export interface InvoiceItem {
  id: number;
  productId: number;
  product: { id: number; name: string; sku: string };
  barcodeScanned: string | null;
  qty: number;
  returnedQty: number;
  mrp: string;
  price: string;
  discount: string;
  taxAmount: string;
  lineTotal: string;
}

export type ReturnReason = "normal" | "defective";

export interface ReturnItem {
  id: number;
  invoiceItemId: number;
  productId: number;
  qty: number;
  reason: ReturnReason;
  refundAmount: string;
  product?: { id: number; name: string; sku: string };
}

export interface Return {
  id: number;
  returnNumber: string;
  invoiceId: number;
  totalRefund: string;
  createdAt: string;
  items: ReturnItem[];
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
  returns: Return[];
}

export interface LowStockRow {
  productId: number;
  productName: string;
  sku: string;
  warehouseId: number;
  warehouseName: string;
  quantity: number;
  reorderLevel: number;
}

export interface DamagedStockRow {
  productId: number;
  productName: string;
  sku: string;
  warehouseId: number;
  warehouseName: string;
  damagedQuantity: number;
}

export interface SalesSummary {
  today: { totalSales: string; invoiceCount: number };
  thisMonth: { totalSales: string; invoiceCount: number };
  topProducts: Array<{ productId: number; productName: string; sku: string; qtySold: number }>;
  salesByWarehouse: Array<{ warehouseId: number; warehouseName: string; totalSales: string }>;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface PurchaseItem {
  id: number;
  productId: number;
  product: { id: number; name: string; sku: string };
  qty: number;
  costPrice: string;
  lineTotal: string;
}

export interface Purchase {
  id: number;
  purchaseNumber: string;
  supplierId: number | null;
  supplier: Supplier | null;
  warehouseId: number;
  warehouse: Warehouse;
  totalAmount: string;
  createdAt: string;
  items: PurchaseItem[];
}

export interface SupplierReturnItem {
  id: number;
  productId: number;
  product: { id: number; name: string; sku: string };
  qty: number;
}

export interface SupplierReturn {
  id: number;
  returnNumber: string;
  supplierId: number | null;
  supplier: Supplier | null;
  warehouseId: number;
  warehouse: Warehouse;
  createdAt: string;
  items: SupplierReturnItem[];
}
