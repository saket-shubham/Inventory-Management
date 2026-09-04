import type { Prisma } from "@prisma/client";

export type AuditAction =
  | "LOGIN"
  | "STOCK_IN"
  | "STOCK_ADJUSTMENT"
  | "STOCK_TRANSFER"
  | "DAMAGE"
  | "SALE"
  | "INVOICE_CANCELLED"
  | "RETURN"
  | "SUPPLIER_RETURN"
  | "PRODUCT_CREATED"
  | "PRODUCT_UPDATED"
  | "PRODUCT_ACTIVATED"
  | "PRODUCT_DEACTIVATED"
  | "STAFF_CREATED"
  | "STAFF_UPDATED"
  | "STAFF_ACTIVATED"
  | "STAFF_DEACTIVATED"
  | "HOLD_CREATED"
  | "HOLD_COMPLETED"
  | "HOLD_RETURNED"
  | "HOLD_EXPIRED";

export type AuditEntityType =
  | "Product"
  | "Stock"
  | "StockTransfer"
  | "Invoice"
  | "Purchase"
  | "Return"
  | "SupplierReturn"
  | "User"
  | "HoldInvoice";

interface RecordAuditInput {
  userId: number;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Writes one audit log row. Always call this with the same transaction client
 * (`tx`) used for the business operation it's describing, so the audit trail
 * can never exist without (or drift from) the change it records.
 */
export async function recordAudit(tx: Prisma.TransactionClient, input: RecordAuditInput) {
  await tx.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
