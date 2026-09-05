import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { generateHoldNumber } from "../services/holdInvoiceNumber";
import { generateInvoiceNumber } from "../services/invoiceNumber";
import { recordAudit } from "../services/auditLog";
import { sweepExpiredHolds } from "../services/holdExpiry";

const HOLD_VALIDITY_DAYS = 3;

const holdItemsInclude = { items: { include: { product: true } }, customer: true, warehouse: true, finalInvoice: true } as const;

const createHoldSchema = z.object({
  warehouseId: z.number().int(),
  customerId: z.number().int().optional(),
  items: z
    .array(z.object({ productId: z.number().int(), qty: z.number().int().positive() }))
    .min(1, "Select at least one item to hold"),
});

export const createHoldInvoice = asyncHandler(async (req: Request, res: Response) => {
  const data = createHoldSchema.parse(req.body);
  const actor = req.user!;

  const hold = await prisma.$transaction(async (tx) => {
    const productIds = data.items.map((i) => i.productId);
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of data.items) {
      if (!productMap.has(item.productId)) {
        throw new ApiError(400, `Product ${item.productId} not found`);
      }
    }

    const stockRows = await tx.stock.findMany({
      where: { warehouseId: data.warehouseId, productId: { in: productIds } },
    });
    const stockMap = new Map(stockRows.map((s) => [s.productId, s]));

    for (const item of data.items) {
      const stock = stockMap.get(item.productId);
      if (!stock || stock.quantity < item.qty) {
        const product = productMap.get(item.productId)!;
        throw new ApiError(
          400,
          `Insufficient stock for "${product.name}" at the selected warehouse (available: ${stock?.quantity ?? 0}, requested: ${item.qty})`
        );
      }
    }

    const holdNumber = await generateHoldNumber(tx);
    const expiresAt = new Date(Date.now() + HOLD_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

    const created = await tx.holdInvoice.create({
      data: {
        holdNumber,
        customerId: data.customerId,
        warehouseId: data.warehouseId,
        expiresAt,
        createdById: actor.id,
        items: {
          create: data.items.map((item) => {
            const product = productMap.get(item.productId)!;
            return {
              productId: item.productId,
              qty: item.qty,
              mrp: product.mrp,
              price: product.sellingPrice,
              taxPercent: product.taxPercent,
            };
          }),
        },
      },
      include: holdItemsInclude,
    });

    // Deduct held quantities from available stock immediately — they can't
    // be sold to anyone else while on hold.
    for (const item of data.items) {
      const stock = stockMap.get(item.productId)!;
      const previousQty = stock.quantity;
      const newQty = previousQty - item.qty;
      await tx.stock.update({ where: { id: stock.id }, data: { quantity: newQty } });
      await tx.stockLedger.create({
        data: {
          productId: item.productId,
          warehouseId: data.warehouseId,
          changeQty: -item.qty,
          previousQty,
          balanceQty: newQty,
          referenceType: "hold",
          referenceId: created.id,
          performedById: actor.id,
          reason: `Held on ${created.holdNumber}`,
        },
      });
    }

    await recordAudit(tx, {
      userId: actor.id,
      action: "HOLD_CREATED",
      entityType: "HoldInvoice",
      entityId: created.id,
      metadata: { holdNumber: created.holdNumber, warehouseId: data.warehouseId, itemCount: data.items.length },
    });

    return created;
  });

  res.status(201).json(hold);
});

const HOLD_STATUSES = ["active", "completed", "returned", "expired"] as const;

export const listHoldInvoices = asyncHandler(async (req: Request, res: Response) => {
  await sweepExpiredHolds();

  const statusParam = req.query.status;
  const status =
    typeof statusParam === "string" && (HOLD_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as (typeof HOLD_STATUSES)[number])
      : undefined;

  const holds = await prisma.holdInvoice.findMany({
    where: status ? { status } : {},
    include: holdItemsInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(holds);
});

export const getHoldInvoice = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await sweepExpiredHolds();

  const hold = await prisma.holdInvoice.findUnique({
    where: { id },
    include: holdItemsInclude,
  });
  if (!hold) throw new ApiError(404, "Hold invoice not found");

  res.json(hold);
});

const processHoldSchema = z.object({
  items: z
    .array(
      z.object({
        holdInvoiceItemId: z.number().int(),
        keepQty: z.number().int().nonnegative(),
        returnNormalQty: z.number().int().nonnegative(),
        returnDamagedQty: z.number().int().nonnegative(),
      })
    )
    .min(1, "Decide on at least one item"),
});

export const processHoldInvoice = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const data = processHoldSchema.parse(req.body);
  const actor = req.user!;

  // Catch the case where this hold just crossed its 3-day expiry — convert it
  // first so the request below sees (and reports) the real, current status.
  await sweepExpiredHolds();

  const result = await prisma.$transaction(async (tx) => {
    const hold = await tx.holdInvoice.findUnique({
      where: { id },
      include: { items: true, warehouse: true },
    });
    if (!hold) throw new ApiError(404, "Hold invoice not found");
    if (hold.status !== "active") {
      throw new ApiError(400, `Hold invoice is already ${hold.status} — it cannot be processed again`);
    }

    const itemMap = new Map(hold.items.map((i) => [i.id, i]));
    for (const line of data.items) {
      if (!itemMap.has(line.holdInvoiceItemId)) {
        throw new ApiError(400, `Item ${line.holdInvoiceItemId} does not belong to this hold invoice`);
      }
    }
    // Every item on the hold must be accounted for in one shot — this is a
    // one-time reconciliation, not an incremental process.
    if (data.items.length !== hold.items.length) {
      throw new ApiError(400, "Every held item must be decided (kept/returned) in this request");
    }
    for (const line of data.items) {
      const item = itemMap.get(line.holdInvoiceItemId)!;
      const accounted = line.keepQty + line.returnNormalQty + line.returnDamagedQty;
      if (accounted !== item.qty) {
        throw new ApiError(
          400,
          `Item ${item.id}: keep + returned (normal + damaged) must add up to the held quantity (${item.qty}), got ${accounted}`
        );
      }
    }

    const productIds = data.items.map((l) => itemMap.get(l.holdInvoiceItemId)!.productId);
    const stockRows = await tx.stock.findMany({
      where: { warehouseId: hold.warehouseId, productId: { in: productIds } },
    });
    const stockMap = new Map(stockRows.map((s) => [s.productId, s]));

    let subtotal = new Prisma.Decimal(0);
    let taxAmount = new Prisma.Decimal(0);
    const keptInvoiceItems: Array<{
      productId: number;
      qty: number;
      mrp: Prisma.Decimal;
      price: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
    }> = [];

    for (const line of data.items) {
      const item = itemMap.get(line.holdInvoiceItemId)!;

      await tx.holdInvoiceItem.update({
        where: { id: item.id },
        data: {
          keptQty: line.keepQty,
          returnedNormalQty: line.returnNormalQty,
          returnedDamagedQty: line.returnDamagedQty,
        },
      });

      if (line.keepQty > 0) {
        const lineBase = item.price.mul(line.keepQty);
        const lineTax = lineBase.mul(item.taxPercent).div(100);
        subtotal = subtotal.add(lineBase);
        taxAmount = taxAmount.add(lineTax);
        keptInvoiceItems.push({
          productId: item.productId,
          qty: line.keepQty,
          mrp: item.mrp,
          price: item.price,
          taxAmount: lineTax,
          lineTotal: lineBase.add(lineTax),
        });
      }

      const returnedQty = line.returnNormalQty + line.returnDamagedQty;
      if (returnedQty > 0) {
        const stock = stockMap.get(item.productId);
        const previousQty = stock?.quantity ?? 0;
        const previousDamagedQty = stock?.damagedQuantity ?? 0;
        const newQty = previousQty + line.returnNormalQty;
        const newDamagedQty = previousDamagedQty + line.returnDamagedQty;

        await tx.stock.upsert({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: hold.warehouseId } },
          update: { quantity: newQty, damagedQuantity: newDamagedQty },
          create: {
            productId: item.productId,
            warehouseId: hold.warehouseId,
            quantity: newQty,
            damagedQuantity: newDamagedQty,
            reorderLevel: 0,
          },
        });

        // Only the normal (sellable) portion moves the ledger balance — the
        // damaged portion follows the same convention as customer returns
        // and mark-damaged: tracked via Stock.damagedQuantity, no ledger row.
        if (line.returnNormalQty > 0) {
          await tx.stockLedger.create({
            data: {
              productId: item.productId,
              warehouseId: hold.warehouseId,
              changeQty: line.returnNormalQty,
              previousQty,
              balanceQty: newQty,
              referenceType: "return",
              referenceId: hold.id,
              performedById: actor.id,
              reason: `Returned from ${hold.holdNumber} (normal)`,
            },
          });
        }
      }
    }

    let finalInvoice = null;
    if (keptInvoiceItems.length > 0) {
      const grandTotal = subtotal.add(taxAmount);
      const invoiceNumber = await generateInvoiceNumber(tx);
      finalInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId: hold.customerId,
          warehouseId: hold.warehouseId,
          subtotal,
          taxAmount,
          grandTotal,
          paymentMode: "cash",
          status: "paid",
          createdById: actor.id,
          holdInvoiceId: hold.id,
          items: { create: keptInvoiceItems },
        },
        include: { items: true },
      });
    }

    const newStatus = keptInvoiceItems.length > 0 ? "completed" : "returned";
    await tx.holdInvoice.update({
      where: { id: hold.id },
      data: { status: newStatus, processedAt: new Date() },
    });

    await recordAudit(tx, {
      userId: actor.id,
      action: newStatus === "completed" ? "HOLD_COMPLETED" : "HOLD_RETURNED",
      entityType: "HoldInvoice",
      entityId: hold.id,
      metadata: {
        holdNumber: hold.holdNumber,
        invoiceNumber: finalInvoice?.invoiceNumber ?? null,
        keptItemCount: keptInvoiceItems.length,
      },
    });

    return tx.holdInvoice.findUniqueOrThrow({
      where: { id: hold.id },
      include: holdItemsInclude,
    });
  });

  res.json(result);
});
