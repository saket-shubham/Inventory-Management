import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

const adjustSchema = z.object({
  productId: z.number().int(),
  warehouseId: z.number().int(),
  changeQty: z.number().int().refine((n) => n !== 0, "changeQty must not be zero"),
  reorderLevel: z.number().int().nonnegative().optional(),
});

export const adjustStock = asyncHandler(async (req: Request, res: Response) => {
  const data = adjustSchema.parse(req.body);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.stock.findUnique({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.warehouseId } },
    });

    const newQty = (existing?.quantity ?? 0) + data.changeQty;
    if (newQty < 0) {
      throw new ApiError(400, "Adjustment would result in negative stock");
    }

    const stock = await tx.stock.upsert({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.warehouseId } },
      update: {
        quantity: newQty,
        ...(data.reorderLevel !== undefined ? { reorderLevel: data.reorderLevel } : {}),
      },
      create: {
        productId: data.productId,
        warehouseId: data.warehouseId,
        quantity: newQty,
        reorderLevel: data.reorderLevel ?? 0,
      },
    });

    await tx.stockLedger.create({
      data: {
        productId: data.productId,
        warehouseId: data.warehouseId,
        changeQty: data.changeQty,
        balanceQty: newQty,
        referenceType: "adjustment",
      },
    });

    return stock;
  });

  res.json(result);
});

const markDamagedSchema = z.object({
  productId: z.number().int(),
  warehouseId: z.number().int(),
  qty: z.number().int().positive(),
});

export const markDamaged = asyncHandler(async (req: Request, res: Response) => {
  const data = markDamagedSchema.parse(req.body);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.stock.findUnique({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.warehouseId } },
    });

    if (!existing || existing.quantity < data.qty) {
      throw new ApiError(
        400,
        `Cannot mark ${data.qty} as damaged — only ${existing?.quantity ?? 0} sellable units available at this warehouse`
      );
    }

    const newQty = existing.quantity - data.qty;
    const newDamagedQty = existing.damagedQuantity + data.qty;

    const stock = await tx.stock.update({
      where: { id: existing.id },
      data: { quantity: newQty, damagedQuantity: newDamagedQty },
    });

    // Moving units out of the sellable pool is logged the same way a manual
    // adjustment would be; the damaged-side of the move is fully captured by
    // Stock.damagedQuantity itself (and later by a SupplierReturn if sent back).
    await tx.stockLedger.create({
      data: {
        productId: data.productId,
        warehouseId: data.warehouseId,
        changeQty: -data.qty,
        balanceQty: newQty,
        referenceType: "adjustment",
      },
    });

    return stock;
  });

  res.json(result);
});

export const listLowStock = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await prisma.stock.findMany({
    include: { product: true, warehouse: true },
    orderBy: { quantity: "asc" },
  });

  const lowStock = rows
    .filter((s) => s.product.isActive && s.quantity <= s.reorderLevel)
    .map((s) => ({
      productId: s.productId,
      productName: s.product.name,
      sku: s.product.sku,
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      quantity: s.quantity,
      reorderLevel: s.reorderLevel,
    }));

  res.json(lowStock);
});

export const listDamagedStock = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await prisma.stock.findMany({
    where: { damagedQuantity: { gt: 0 } },
    include: { product: true, warehouse: true },
    orderBy: { damagedQuantity: "desc" },
  });

  res.json(
    rows.map((s) => ({
      productId: s.productId,
      productName: s.product.name,
      sku: s.product.sku,
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      damagedQuantity: s.damagedQuantity,
    }))
  );
});
