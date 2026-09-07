import type { Prisma } from "@prisma/client";
import { getNextDocumentNumber } from "./documentNumber";

/**
 * Generates the next sequential supplier-return number for the current year, e.g. SR-2026-00001.
 * Must be called inside the same transaction that inserts the supplier return.
 */
export async function generateSupplierReturnNumber(tx: Prisma.TransactionClient): Promise<string> {
  return getNextDocumentNumber(tx, "SUPPLIER_RETURN", "SR-");
}
