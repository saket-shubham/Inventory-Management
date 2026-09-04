import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { generatePurchaseNumber } from "../services/purchaseNumber";
import { recordAudit } from "../services/auditLog";

const createPurchaseSchema = z.object({
  supplierId: z.number().int().optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int(),
        warehouseId: z.number().int(),
        qty: z.number().int().positive(),
        // Units of this line that arrived already damaged (Damage on
        // Transit) — kept separate from `qty`, and never added to normal
        // stock, only to the damaged bucket.
        damagedQty: z.number().int().nonnegative().default(0),
        costPrice: z.number().nonnegative(),
      })
    )
    .min(1, "Purchase must contain at least one item"),
});

export const createPurchase = asyncHandler(async (req: Request, res: Response) => {
  const data = createPurchaseSchema.parse(req.body);
  const actor = req.user!;

  const purchase = await prisma.$transaction(async (tx) => {
    const productIds = [...new Set(data.items.map((i) => i.productId))];
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of data.items) {
      if (!productMap.has(item.productId)) {
        throw new ApiError(400, `Product ${item.productId} not found`);
      }
    }

    let totalAmount = new Prisma.Decimal(0);
    const itemsData = data.items.map((item) => {
      // Cost accounting is unchanged — the bill is based on qty (good units)
      // exactly as before; damagedQty is tracked for inventory purposes only.
      const lineTotal = new Prisma.Decimal(item.costPrice).mul(item.qty);
      totalAmount = totalAmount.add(lineTotal);
      return {
        productId: item.productId,
        warehouseId: item.warehouseId,
        qty: item.qty,
        damagedQty: item.damagedQty,
        costPrice: item.costPrice,
        lineTotal,
      };
    });

    const purchaseNumber = await generatePurchaseNumber(tx);

    const created = await tx.purchase.create({
      data: {
        purchaseNumber,
        supplierId: data.supplierId,
        totalAmount,
        createdById: actor.id,
        items: { create: itemsData },
      },
      include: { items: { include: { product: true, warehouse: true } }, supplier: true },
    });

    for (const item of data.items) {
      const existing = await tx.stock.findUnique({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
      });
      const previousQty = existing?.quantity ?? 0;
      const newQty = previousQty + item.qty;
      const previousDamagedQty = existing?.damagedQuantity ?? 0;
      const previousDamagedTransitQty = existing?.damagedQuantityTransit ?? 0;
      const newDamagedQty = previousDamagedQty + item.damagedQty;
      const newDamagedTransitQty = previousDamagedTransitQty + item.damagedQty;

      await tx.stock.upsert({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: item.warehouseId } },
        update: { quantity: newQty, damagedQuantity: newDamagedQty, damagedQuantityTransit: newDamagedTransitQty },
        create: {
          productId: item.productId,
          warehouseId: item.warehouseId,
          quantity: newQty,
          damagedQuantity: newDamagedQty,
          damagedQuantityTransit: newDamagedTransitQty,
          reorderLevel: 0,
        },
      });

      // Only the good units ever move through the sellable-stock ledger —
      // damaged-on-arrival units never entered `quantity`, so there's nothing
      // to log there (mirrors how mark-damaged and defective returns already
      // treat the damaged bucket: tracked via Stock fields, no ledger row).
      await tx.stockLedger.create({
        data: {
          productId: item.productId,
          warehouseId: item.warehouseId,
          changeQty: item.qty,
          previousQty,
          balanceQty: newQty,
          referenceType: "purchase",
          referenceId: created.id,
          performedById: actor.id,
          ...(item.damagedQty > 0 ? { reason: `${item.damagedQty} unit(s) received damaged (transit)` } : {}),
        },
      });
    }

    await recordAudit(tx, {
      userId: actor.id,
      action: "STOCK_IN",
      entityType: "Purchase",
      entityId: created.id,
      metadata: {
        purchaseNumber: created.purchaseNumber,
        totalAmount: totalAmount.toString(),
        items: created.items.map((i) => ({
          productId: i.productId,
          productName: i.product.name,
          warehouseId: i.warehouseId,
          warehouseName: i.warehouse.name,
          qty: i.qty,
          damagedQty: i.damagedQty,
        })),
      },
    });

    return created;
  });

  res.status(201).json(purchase);
});

export const listPurchases = asyncHandler(async (_req: Request, res: Response) => {
  const purchases = await prisma.purchase.findMany({
    include: { supplier: true, items: { include: { product: true, warehouse: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(purchases);
});

export const getPurchase = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: { items: { include: { product: true, warehouse: true } }, supplier: true },
  });
  if (!purchase) throw new ApiError(404, "Purchase not found");
  res.json(purchase);
});
