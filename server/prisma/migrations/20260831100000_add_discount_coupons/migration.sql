-- Discount coupon feature: a manageable code -> percentage table, plus the
-- (all-nullable, additive) invoice columns that snapshot which coupon — if
-- any — was applied at billing time. Existing invoices are untouched: these
-- columns simply stay NULL for every historical row, and the existing
-- `discount` (flat rupee) column and its behavior are not modified at all.

CREATE TABLE "coupons" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

ALTER TABLE "invoices" ADD COLUMN "coupon_code" TEXT;
ALTER TABLE "invoices" ADD COLUMN "coupon_discount_percent" DECIMAL(5,2);
ALTER TABLE "invoices" ADD COLUMN "coupon_discount_amount" DECIMAL(12,2);
