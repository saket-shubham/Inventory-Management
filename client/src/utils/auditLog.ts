import type { AuditLog } from "../types";

export const AUDIT_ACTIONS = [
  "STOCK_IN",
  "STOCK_ADJUSTMENT",
  "STOCK_TRANSFER",
  "DAMAGE",
  "SALE",
  "INVOICE_CANCELLED",
  "RETURN",
  "SUPPLIER_RETURN",
  "PRODUCT_CREATED",
  "PRODUCT_UPDATED",
  "PRODUCT_ACTIVATED",
  "PRODUCT_DEACTIVATED",
  "STAFF_CREATED",
  "STAFF_UPDATED",
  "STAFF_ACTIVATED",
  "STAFF_DEACTIVATED",
] as const;

const ACTION_LABELS: Record<string, string> = {
  STOCK_IN: "Stock In (Purchase)",
  STOCK_ADJUSTMENT: "Stock Adjustment",
  STOCK_TRANSFER: "Stock Transfer",
  DAMAGE: "Marked Damaged",
  SALE: "Sale",
  INVOICE_CANCELLED: "Invoice Cancelled",
  RETURN: "Customer Return",
  SUPPLIER_RETURN: "Supplier Return",
  PRODUCT_CREATED: "Product Created",
  PRODUCT_UPDATED: "Product Updated",
  PRODUCT_ACTIVATED: "Product Activated",
  PRODUCT_DEACTIVATED: "Product Deactivated",
  STAFF_CREATED: "Staff Created",
  STAFF_UPDATED: "Staff Updated",
  STAFF_ACTIVATED: "Staff Activated",
  STAFF_DEACTIVATED: "Staff Deactivated",
};

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** Human-readable one-liner for an audit log row's `metadata`, tailored per action. */
export function auditDetails(log: AuditLog): string {
  const m = (log.metadata ?? {}) as Record<string, any>;
  switch (log.action) {
    case "STOCK_ADJUSTMENT": {
      const sign = m.changeQty >= 0 ? "+" : "";
      return `${m.productName} @ ${m.warehouseName}: ${m.previousQty} → ${m.newQty} (${sign}${m.changeQty})${m.reason ? ` — ${m.reason}` : ""}`;
    }
    case "STOCK_TRANSFER":
      return `${m.productName}: ${m.qty} unit(s) ${m.fromWarehouseName} → ${m.toWarehouseName}${m.reason ? ` — ${m.reason}` : ""}`;
    case "DAMAGE":
      return `${m.productName} @ ${m.warehouseName}: ${m.qty} unit(s) marked damaged (${m.previousQty} → ${m.newQty})`;
    case "STOCK_IN": {
      if (m.bulk) return `${m.count} product(s) added in bulk`;
      const itemCount = Array.isArray(m.items) ? m.items.length : 0;
      return `${m.purchaseNumber} — ${itemCount} item(s), ₹${Number(m.totalAmount).toFixed(2)}`;
    }
    case "SALE":
      return `${m.invoiceNumber} — ${m.itemCount} item(s), ₹${Number(m.grandTotal).toFixed(2)}`;
    case "INVOICE_CANCELLED":
      return `${m.invoiceNumber} cancelled`;
    case "RETURN":
      return `${m.returnNumber} against ${m.invoiceNumber} — refund ₹${Number(m.totalRefund).toFixed(2)}`;
    case "SUPPLIER_RETURN": {
      const itemCount = Array.isArray(m.items) ? m.items.length : 0;
      return `${m.returnNumber} @ ${m.warehouseName} — ${itemCount} item(s)`;
    }
    case "PRODUCT_CREATED":
      return m.bulk ? `${m.count} product(s) added in bulk` : `${m.name} (${m.sku})`;
    case "PRODUCT_UPDATED":
      return `${m.name} — fields changed: ${(m.changes ?? []).join(", ")}`;
    case "PRODUCT_ACTIVATED":
    case "PRODUCT_DEACTIVATED":
      return `${m.name}`;
    case "STAFF_CREATED":
      return `${m.name} (${m.email})`;
    case "STAFF_UPDATED":
      return `${m.name} — fields changed: ${(m.changes ?? []).join(", ")}`;
    case "STAFF_ACTIVATED":
    case "STAFF_DEACTIVATED":
      return `${m.name} (${m.email})`;
    default:
      return JSON.stringify(m);
  }
}
