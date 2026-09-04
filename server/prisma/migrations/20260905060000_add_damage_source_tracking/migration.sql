-- Damage Source tracking (Damage on Transit vs Damage on Showroom), built as a
-- minimal extension of the EXISTING damaged-stock system rather than a
-- parallel one:
--   - stock.damaged_quantity keeps its existing meaning (grand total damaged)
--     and every existing read/write of it is untouched.
--   - stock.damaged_quantity_transit is new: the subset of that total which
--     came from Damage on Transit. The remainder is implicitly Damage on
--     Showroom. Existing rows default to 0, i.e. all pre-existing damaged
--     stock is safely classified as Showroom (there is no way to know its
--     real historical source, and Showroom is the correct default since that
--     covers every damage path that already existed before this migration).
--   - purchase_items.damaged_qty is new: how many units of that PO line
--     arrived damaged, for audit/traceability. It never adds to `qty` or to
--     normal stock.
ALTER TABLE "stock" ADD COLUMN "damaged_quantity_transit" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "purchase_items" ADD COLUMN "damaged_qty" INTEGER NOT NULL DEFAULT 0;
