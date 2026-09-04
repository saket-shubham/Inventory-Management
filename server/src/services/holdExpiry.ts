import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { generateInvoiceNumber } from "./invoiceNumber";
import { recordAudit } from "./auditLog";

/**
 * Finds every Hold Invoice that is still "active" but past its 3-day expiry,
 * and auto-converts it: every held unit is treated as SOLD (never restocked —
 * the physical item may still be with the customer), a real Invoice is
 * generated for the full held quantity, and the hold is marked "expired".
 *
 * Safe to call repeatedly/concurrently with itself — each hold is only ever
 * touched while its status is still "active" inside its own transaction, so a
 * hold that's already been processed (by a customer decision or a previous
 * sweep) is simply skipped.
 *
 * Called on server startup, on an interval, and lazily whenever hold invoices
 * are listed/fetched — so an expiry is reflected even if the server was down
 * across the 3-day window.
 */
export async function sweepExpiredHolds(): Promise<number> {
  const expired = await prisma.holdInvoice.findMany({
    where: { status: "active", expiresAt: { lt: new Date() } },
    select: { id: true },
  });

  let convertedCount = 0;
  for (const { id } of expired) {
    const converted = await convertExpiredHold(id);
    if (converted) convertedCount++;
  }
  return convertedCount;
}

async function convertExpiredHold(holdInvoiceId: number): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      // Re-check status inside the transaction — guards against a race with a
      // customer-decision request that processed this same hold in parallel.
      const hold = await tx.holdInvoice.findUnique({
        where: { id: holdInvoiceId },
        include: { items: true },
      });
      if (!hold || hold.status !== "active" || hold.expiresAt >= new Date()) return;

      let subtotal = new Prisma.Decimal(0);
      let taxAmount = new Prisma.Decimal(0);
      const itemsData = hold.items.map((item) => {
        const lineBase = item.price.mul(item.qty);
        const lineTax = lineBase.mul(item.taxPercent).div(100);
        const lineTotal = lineBase.add(lineTax);
        subtotal = subtotal.add(lineBase);
        taxAmount = taxAmount.add(lineTax);
        return {
          productId: item.productId,
          qty: item.qty,
          mrp: item.mrp,
          price: item.price,
          taxAmount: lineTax,
          lineTotal,
        };
      });
      const grandTotal = subtotal.add(taxAmount);

      const invoiceNumber = await generateInvoiceNumber(tx);
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId: hold.customerId,
          warehouseId: hold.warehouseId,
          subtotal,
          taxAmount,
          grandTotal,
          paymentMode: "cash",
          status: "paid",
          createdById: hold.createdById,
          holdInvoiceId: hold.id,
          items: { create: itemsData },
        },
      });

      // Every held unit is now fully "kept" — no stock movement here, since it
      // was already deducted when the hold was created.
      for (const item of hold.items) {
        await tx.holdInvoiceItem.update({ where: { id: item.id }, data: { keptQty: item.qty } });
      }

      await tx.holdInvoice.update({
        where: { id: hold.id },
        data: { status: "expired", processedAt: new Date() },
      });

      if (hold.createdById) {
        await recordAudit(tx, {
          userId: hold.createdById,
          action: "HOLD_EXPIRED",
          entityType: "HoldInvoice",
          entityId: hold.id,
          metadata: {
            holdNumber: hold.holdNumber,
            invoiceNumber: invoice.invoiceNumber,
            itemCount: hold.items.length,
          },
        });
      }
    });
    return true;
  } catch (err) {
    // A single hold failing to convert (e.g. a genuine race) must not stop the
    // sweep from processing the rest.
    console.error(`Failed to auto-expire hold invoice ${holdInvoiceId}:`, err);
    return false;
  }
}
