import type { Prisma } from "@prisma/client";
import { env } from "../config/env";

/**
 * Generates the next sequential invoice number for the current year, e.g. INV-2026-00001.
 * Must be called inside the same transaction that inserts the invoice, so the count
 * reflects invoices committed so far this year.
 */
export async function generateInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const yearPrefix = `${env.invoicePrefix}${year}-`;

  const count = await tx.invoice.count({
    where: { invoiceNumber: { startsWith: yearPrefix } },
  });

  const sequence = String(count + 1).padStart(5, "0");
  return `${yearPrefix}${sequence}`;
}
