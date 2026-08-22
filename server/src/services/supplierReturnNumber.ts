import type { Prisma } from "@prisma/client";

/**
 * Generates the next sequential supplier-return number for the current year, e.g. SR-2026-00001.
 * Must be called inside the same transaction that inserts the supplier return.
 */
export async function generateSupplierReturnNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const yearPrefix = `SR-${year}-`;

  const count = await tx.supplierReturn.count({
    where: { returnNumber: { startsWith: yearPrefix } },
  });

  const sequence = String(count + 1).padStart(5, "0");
  return `${yearPrefix}${sequence}`;
}
