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
