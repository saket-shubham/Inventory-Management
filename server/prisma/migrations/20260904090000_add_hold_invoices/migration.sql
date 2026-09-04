-- Hold Bill / Hold Invoice feature.
-- Entirely new, separate tables — no existing table's data or behavior changes
-- except: `invoices` gets one new nullable, unique column linking back to the
-- hold it was generated from (NULL for every normal sale, past and future).

-- 1. New ledger reference type for the initial hold-time stock deduction.
ALTER TYPE "LedgerReferenceType" ADD VALUE 'hold';

-- 2. Hold invoice status.
CREATE TYPE "HoldStatus" AS ENUM ('active', 'completed', 'returned', 'expired');

-- 3. Hold invoices themselves.
CREATE TABLE "hold_invoices" (
    "id" SERIAL NOT NULL,
    "hold_number" TEXT NOT NULL,
    "customer_id" INTEGER,
    "warehouse_id" INTEGER NOT NULL,
    "status" "HoldStatus" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hold_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hold_invoices_hold_number_key" ON "hold_invoices"("hold_number");

ALTER TABLE "hold_invoices" ADD CONSTRAINT "hold_invoices_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hold_invoices" ADD CONSTRAINT "hold_invoices_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hold_invoices" ADD CONSTRAINT "hold_invoices_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Hold invoice line items — snapshot pricing, plus the keep/return split
--    filled in once the hold is processed.
CREATE TABLE "hold_invoice_items" (
    "id" SERIAL NOT NULL,
    "hold_invoice_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "mrp" DECIMAL(10,2) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "tax_percent" DECIMAL(5,2) NOT NULL,
    "kept_qty" INTEGER NOT NULL DEFAULT 0,
    "returned_normal_qty" INTEGER NOT NULL DEFAULT 0,
    "returned_damaged_qty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hold_invoice_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "hold_invoice_items" ADD CONSTRAINT "hold_invoice_items_hold_invoice_id_fkey"
  FOREIGN KEY ("hold_invoice_id") REFERENCES "hold_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hold_invoice_items" ADD CONSTRAINT "hold_invoice_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Link a real Invoice back to the Hold Invoice it was generated from (kept
--    items, or an auto-expiry). NULL for every ordinary sale.
ALTER TABLE "invoices" ADD COLUMN "hold_invoice_id" INTEGER;
CREATE UNIQUE INDEX "invoices_hold_invoice_id_key" ON "invoices"("hold_invoice_id");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_hold_invoice_id_fkey"
  FOREIGN KEY ("hold_invoice_id") REFERENCES "hold_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
