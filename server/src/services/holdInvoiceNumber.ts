import type { Prisma } from "@prisma/client";

/**
 * Generates the next sequential Hold Invoice number for the current year,
 * e.g. HOLD-2026-00001. Must be called inside the same transaction that
 * inserts the hold invoice, mirroring services/invoiceNumber.ts.
 */
export async function generateHoldNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const yearPrefix = `HOLD-${year}-`;

  const count = await tx.holdInvoice.count({
    where: { holdNumber: { startsWith: yearPrefix } },
  });

  const sequence = String(count + 1).padStart(5, "0");
  return `${yearPrefix}${sequence}`;
}
