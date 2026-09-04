export type UserRole = "admin" | "staff";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface AuditLog {
  id: number;
  userId: number;
  user: { id: number; name: string; email: string; role: UserRole };
  action: string;
  entityType: string;
  entityId: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface StockTransfer {
  id: number;
  productId: number;
  fromWarehouseId: number;
  toWarehouseId: number;
  qty: number;
  fromPreviousQty: number;
  fromNewQty: number;
  toPreviousQty: number;
  toNewQty: number;
  performedById: number | null;
  reason: string | null;
  createdAt: string;
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
  imageData?: string | null;
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
  createdAt?: string;
  updatedAt?: string;
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
  couponCode: string | null;
  couponDiscountPercent: string | null;
  couponDiscountAmount: string | null;
  grandTotal: string;
  paymentMode: PaymentMode;
  status: "draft" | "paid" | "cancelled";
  createdAt: string;
  items: InvoiceItem[];
  returns: Return[];
}

export interface Coupon {
  id: number;
  code: string;
  discountPercent: string;
  isActive: boolean;
  createdAt: string;
}

export type HoldStatus = "active" | "completed" | "returned" | "expired";

export interface HoldInvoiceItem {
  id: number;
  holdInvoiceId: number;
  productId: number;
  product: { id: number; name: string; sku: string; barcode: string };
  qty: number;
  mrp: string;
  price: string;
  taxPercent: string;
  keptQty: number;
  returnedNormalQty: number;
  returnedDamagedQty: number;
}

export interface HoldInvoice {
  id: number;
  holdNumber: string;
  customerId: number | null;
  customer: Customer | null;
  warehouseId: number;
  warehouse: Warehouse;
  status: HoldStatus;
  expiresAt: string;
  processedAt: string | null;
  createdAt: string;
  items: HoldInvoiceItem[];
  finalInvoice: { id: number; invoiceNumber: string; grandTotal: string } | null;
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

export type DamageSource = "transit" | "showroom";

export interface DamagedStockRow {
  productId: number;
  productName: string;
  sku: string;
  warehouseId: number;
  warehouseName: string;
  damagedQuantity: number;
  damageSource: DamageSource;
  updatedAt: string;
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
  warehouseId: number;
  warehouse: { id: number; name: string };
  qty: number;
  damagedQty: number;
  costPrice: string;
  lineTotal: string;
}

export interface Purchase {
  id: number;
  purchaseNumber: string;
  supplierId: number | null;
  supplier: Supplier | null;
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
