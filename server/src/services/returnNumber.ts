import type { Prisma } from "@prisma/client";
import { getNextDocumentNumber } from "./documentNumber";

/**
 * Generates the next sequential customer-return number for the current year, e.g. RET-2026-00001.
 * Must be called inside the same transaction that inserts the return.
 */
export async function generateReturnNumber(tx: Prisma.TransactionClient): Promise<string> {
  return getNextDocumentNumber(tx, "RETURN", "RET-");
}
