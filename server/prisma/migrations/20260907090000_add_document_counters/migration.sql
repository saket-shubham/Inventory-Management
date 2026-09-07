CREATE TABLE "document_counters" (
    "document_type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_counters_pkey" PRIMARY KEY ("document_type","year")
);

-- Seed every counter from the highest sequence number already in use per
-- year, so numbering continues seamlessly from wherever the old
-- COUNT(*)-based generators left off — nothing gets reused, nothing skips.

INSERT INTO "document_counters" ("document_type", "year", "last_number")
SELECT 'INVOICE', year, MAX(seq)
FROM (
    SELECT
        (regexp_match(invoice_number, '(\d{4})-(\d{5})$'))[1]::int AS year,
        (regexp_match(invoice_number, '(\d{4})-(\d{5})$'))[2]::int AS seq
    FROM invoices
    WHERE invoice_number ~ '\d{4}-\d{5}$'
) x
GROUP BY year;

INSERT INTO "document_counters" ("document_type", "year", "last_number")
SELECT 'HOLD', year, MAX(seq)
FROM (
    SELECT
        (regexp_match(hold_number, '(\d{4})-(\d{5})$'))[1]::int AS year,
        (regexp_match(hold_number, '(\d{4})-(\d{5})$'))[2]::int AS seq
    FROM hold_invoices
    WHERE hold_number ~ '\d{4}-\d{5}$'
) x
GROUP BY year;

INSERT INTO "document_counters" ("document_type", "year", "last_number")
SELECT 'RETURN', year, MAX(seq)
FROM (
    SELECT
        (regexp_match(return_number, '(\d{4})-(\d{5})$'))[1]::int AS year,
        (regexp_match(return_number, '(\d{4})-(\d{5})$'))[2]::int AS seq
    FROM returns
    WHERE return_number ~ '\d{4}-\d{5}$'
) x
GROUP BY year;

INSERT INTO "document_counters" ("document_type", "year", "last_number")
SELECT 'PURCHASE', year, MAX(seq)
FROM (
    SELECT
        (regexp_match(purchase_number, '(\d{4})-(\d{5})$'))[1]::int AS year,
        (regexp_match(purchase_number, '(\d{4})-(\d{5})$'))[2]::int AS seq
    FROM purchases
    WHERE purchase_number ~ '\d{4}-\d{5}$'
) x
GROUP BY year;

INSERT INTO "document_counters" ("document_type", "year", "last_number")
SELECT 'SUPPLIER_RETURN', year, MAX(seq)
FROM (
    SELECT
        (regexp_match(return_number, '(\d{4})-(\d{5})$'))[1]::int AS year,
        (regexp_match(return_number, '(\d{4})-(\d{5})$'))[2]::int AS seq
    FROM supplier_returns
    WHERE return_number ~ '\d{4}-\d{5}$'
) x
GROUP BY year;
