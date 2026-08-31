-- Staff authentication + full audit trail.
-- Renames the "cashier" role to "staff", adds user lifecycle fields, records who
-- performed every stock/invoice/purchase/return mutation, and adds a general
-- audit log plus a proper atomic stock-transfer record.

-- 1. Rename the role enum value. Existing rows keep their id/data untouched —
--    every account that was "cashier" simply reads as "staff" from here on.
ALTER TYPE "UserRole" RENAME VALUE 'cashier' TO 'staff';

-- 2. User lifecycle fields.
ALTER TABLE "users" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "users" ADD COLUMN "last_login_at" TIMESTAMP(3);

-- 3. New ledger reference type for atomic warehouse-to-warehouse transfers.
ALTER TYPE "LedgerReferenceType" ADD VALUE 'transfer';

-- 4. StockLedger: who did it, why, and what the balance was immediately before.
ALTER TABLE "stock_ledger" ADD COLUMN "performed_by_id" INTEGER;
ALTER TABLE "stock_ledger" ADD COLUMN "reason" TEXT;
ALTER TABLE "stock_ledger" ADD COLUMN "previous_qty" INTEGER;

-- Backfill: previous balance = new balance - the change that produced it.
UPDATE "stock_ledger" SET "previous_qty" = "balance_qty" - "change_qty";
ALTER TABLE "stock_ledger" ALTER COLUMN "previous_qty" SET NOT NULL;

ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_performed_by_id_fkey"
  FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. "Performed by" on every other mutating record. Nullable: historical rows
--    predate this feature and genuinely have no recorded actor.
ALTER TABLE "invoices" ADD COLUMN "created_by_id" INTEGER;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchases" ADD COLUMN "created_by_id" INTEGER;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "returns" ADD COLUMN "created_by_id" INTEGER;
ALTER TABLE "returns" ADD CONSTRAINT "returns_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_returns" ADD COLUMN "created_by_id" INTEGER;
ALTER TABLE "supplier_returns" ADD CONSTRAINT "supplier_returns_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Atomic warehouse-to-warehouse stock transfers (replaces the old two
--    separate /stock/adjust calls with one all-or-nothing record).
CREATE TABLE "stock_transfers" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "from_warehouse_id" INTEGER NOT NULL,
    "to_warehouse_id" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "from_previous_qty" INTEGER NOT NULL,
    "from_new_qty" INTEGER NOT NULL,
    "to_previous_qty" INTEGER NOT NULL,
    "to_new_qty" INTEGER NOT NULL,
    "performed_by_id" INTEGER,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_warehouse_id_fkey"
  FOREIGN KEY ("from_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_warehouse_id_fkey"
  FOREIGN KEY ("to_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_performed_by_id_fkey"
  FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. General audit log — who did what, to what, and when.
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs"("entity_type");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
