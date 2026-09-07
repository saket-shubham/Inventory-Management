import type { Prisma } from "@prisma/client";

/**
 * Generates the next sequential document number for the given type/prefix,
 * e.g. "INV-2026-00031". Backed by one row per (documentType, year) in
 * DocumentCounter, incremented atomically at the database level — two
 * concurrent callers can never read the same value, and deleting a document
 * later never causes a number to be reused (the counter only moves forward).
 *
 * Must be called inside the same transaction that inserts the document, so
 * the increment only sticks if the document itself is actually saved.
 */
export async function getNextDocumentNumber(
  tx: Prisma.TransactionClient,
  documentType: string,
  prefix: string
): Promise<string> {
  const year = new Date().getFullYear();

  const counter = await tx.documentCounter.upsert({
    where: { documentType_year: { documentType, year } },
    create: { documentType, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });

  const sequence = String(counter.lastNumber).padStart(5, "0");
  return `${prefix}${year}-${sequence}`;
}
