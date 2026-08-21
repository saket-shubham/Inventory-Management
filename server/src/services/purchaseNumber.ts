import type { Prisma } from "@prisma/client";

/**
 * Generates the next sequential purchase number for the current year, e.g. PO-2026-00001.
 * Must be called inside the same transaction that inserts the purchase, so the count
 * reflects purchases committed so far this year.
 */
export async function generatePurchaseNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const yearPrefix = `PO-${year}-`;

  const count = await tx.purchase.count({
    where: { purchaseNumber: { startsWith: yearPrefix } },
  });

  const sequence = String(count + 1).padStart(5, "0");
  return `${yearPrefix}${sequence}`;
}
