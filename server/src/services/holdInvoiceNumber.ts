import type { Prisma } from "@prisma/client";
import { getNextDocumentNumber } from "./documentNumber";

/**
 * Generates the next sequential Hold Invoice number for the current year,
 * e.g. HOLD-2026-00001. Must be called inside the same transaction that
 * inserts the hold invoice.
 */
export async function generateHoldNumber(tx: Prisma.TransactionClient): Promise<string> {
  return getNextDocumentNumber(tx, "HOLD", "HOLD-");
}
