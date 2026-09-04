-- Replace the old flat/manual rupee "discount" field on invoices with the
-- coupon-based percentage discount system entirely. The coupon columns
-- (coupon_code, coupon_discount_percent, coupon_discount_amount) already
-- cover this going forward, so the flat discount column is now dead weight.
ALTER TABLE "invoices" DROP COLUMN "discount";
