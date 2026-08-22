import type { Prisma } from "@prisma/client";

/**
 * Generates the next sequential customer-return number for the current year, e.g. RET-2026-00001.
 * Must be called inside the same transaction that inserts the return.
 */
export async function generateReturnNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const yearPrefix = `RET-${year}-`;

  const count = await tx.return.count({
    where: { returnNumber: { startsWith: yearPrefix } },
  });

  const sequence = String(count + 1).padStart(5, "0");
  return `${yearPrefix}${sequence}`;
}
