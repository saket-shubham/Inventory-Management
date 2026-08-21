import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { generatePurchaseNumber } from "../services/purchaseNumber";

const createPurchaseSchema = z.object({
  warehouseId: z.number().int(),
  supplierId: z.number().int().optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int(),
        qty: z.number().int().positive(),
        costPrice: z.number().nonnegative(),
      })
    )
    .min(1, "Purchase must contain at least one item"),
});

export const createPurchase = asyncHandler(async (req: Request, res: Response) => {
  const data = createPurchaseSchema.parse(req.body);

  const purchase = await prisma.$transaction(async (tx) => {
    const productIds = data.items.map((i) => i.productId);
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of data.items) {
      if (!productMap.has(item.productId)) {
        throw new ApiError(400, `Product ${item.productId} not found`);
      }
    }

    let totalAmount = new Prisma.Decimal(0);
    const itemsData = data.items.map((item) => {
      const lineTotal = new Prisma.Decimal(item.costPrice).mul(item.qty);
      totalAmount = totalAmount.add(lineTotal);
      return {
        productId: item.productId,
        qty: item.qty,
        costPrice: item.costPrice,
        lineTotal,
      };
    });

    const purchaseNumber = await generatePurchaseNumber(tx);

    const created = await tx.purchase.create({
      data: {
        purchaseNumber,
        supplierId: data.supplierId,
        warehouseId: data.warehouseId,
        totalAmount,
        items: { create: itemsData },
      },
      include: { items: { include: { product: true } }, supplier: true, warehouse: true },
    });

    for (const item of data.items) {
      const existing = await tx.stock.findUnique({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: data.warehouseId } },
      });
      const newQty = (existing?.quantity ?? 0) + item.qty;

      await tx.stock.upsert({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: data.warehouseId } },
        update: { quantity: newQty },
        create: { productId: item.productId, warehouseId: data.warehouseId, quantity: newQty, reorderLevel: 0 },
      });

      await tx.stockLedger.create({
        data: {
          productId: item.productId,
          warehouseId: data.warehouseId,
          changeQty: item.qty,
          balanceQty: newQty,
          referenceType: "purchase",
          referenceId: created.id,
        },
      });
    }

    return created;
  });

  res.status(201).json(purchase);
});

export const listPurchases = asyncHandler(async (_req: Request, res: Response) => {
  const purchases = await prisma.purchase.findMany({
    include: { supplier: true, warehouse: true, items: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(purchases);
});

export const getPurchase = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, supplier: true, warehouse: true },
  });
  if (!purchase) throw new ApiError(404, "Purchase not found");
  res.json(purchase);
});
