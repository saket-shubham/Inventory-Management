-- Move warehouse_id from purchases (one per PO) down to purchase_items (one per line),
-- so a single purchase order can span multiple warehouses.

-- 1. Add the new column, nullable for now so we can backfill it.
ALTER TABLE "purchase_items" ADD COLUMN "warehouse_id" INTEGER;

-- 2. Backfill every existing line item with its parent purchase's warehouse.
UPDATE "purchase_items" AS pi
SET "warehouse_id" = p."warehouse_id"
FROM "purchases" AS p
WHERE p."id" = pi."purchase_id";

-- 3. Now that every row has a value, enforce NOT NULL.
ALTER TABLE "purchase_items" ALTER COLUMN "warehouse_id" SET NOT NULL;

-- 4. Add the FK constraint.
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Drop the old per-purchase warehouse column and its FK.
ALTER TABLE "purchases" DROP CONSTRAINT "purchases_warehouse_id_fkey";
ALTER TABLE "purchases" DROP COLUMN "warehouse_id";
