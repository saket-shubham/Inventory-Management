-- Customer Management feature: identify/dedupe customers by phone (doubles as
-- WhatsApp number), and add lifecycle timestamps. Purely additive — existing
-- customer rows and their data are untouched.

ALTER TABLE "customers" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "customers" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");
