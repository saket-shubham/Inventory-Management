-- BUG-005: idempotency protection against duplicate invoice creation
ALTER TABLE "invoices" ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "invoices_idempotency_key_key" ON "invoices"("idempotency_key");

-- BUG-002: frozen customer/warehouse snapshot, independent of the live rows
ALTER TABLE "invoices" ADD COLUMN "customer_name_snapshot" TEXT;
ALTER TABLE "invoices" ADD COLUMN "customer_phone_snapshot" TEXT;
ALTER TABLE "invoices" ADD COLUMN "customer_gst_snapshot" TEXT;
ALTER TABLE "invoices" ADD COLUMN "customer_address_snapshot" TEXT;
ALTER TABLE "invoices" ADD COLUMN "warehouse_name_snapshot" TEXT;
ALTER TABLE "invoices" ADD COLUMN "warehouse_location_snapshot" TEXT;

-- BUG-010: missing indexes for Invoice History's default sort/filters
CREATE INDEX "invoices_created_at_idx" ON "invoices"("created_at");
CREATE INDEX "invoices_customer_id_idx" ON "invoices"("customer_id");
CREATE INDEX "invoices_warehouse_id_idx" ON "invoices"("warehouse_id");
