import type { Prisma } from "@prisma/client";
import { env } from "../config/env";
import { getNextDocumentNumber } from "./documentNumber";

/**
 * Generates the next sequential invoice number for the current year, e.g. INV-2026-00001.
 * Must be called inside the same transaction that inserts the invoice.
 */
export async function generateInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
  return getNextDocumentNumber(tx, "INVOICE", env.invoicePrefix);
}
