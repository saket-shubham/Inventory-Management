import type { Prisma } from "@prisma/client";
import { getNextDocumentNumber } from "./documentNumber";

/**
 * Generates the next sequential purchase number for the current year, e.g. PO-2026-00001.
 * Must be called inside the same transaction that inserts the purchase.
 */
export async function generatePurchaseNumber(tx: Prisma.TransactionClient): Promise<string> {
  return getNextDocumentNumber(tx, "PURCHASE", "PO-");
}
