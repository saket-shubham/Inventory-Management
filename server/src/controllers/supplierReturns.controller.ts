import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { generateSupplierReturnNumber } from "../services/supplierReturnNumber";
import { recordAudit } from "../services/auditLog";

const createSupplierReturnSchema = z.object({
  warehouseId: z.number().int(),
  supplierId: z.number().int().optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int(),
        qty: z.number().int().positive(),
      })
    )
    .min(1, "Supplier return must contain at least one item"),
});

export const createSupplierReturn = asyncHandler(async (req: Request, res: Response) => {
  const data = createSupplierReturnSchema.parse(req.body);
  const actor = req.user!;

  const supplierReturn = await prisma.$transaction(async (tx) => {
    const stockRows = await tx.stock.findMany({
      where: { warehouseId: data.warehouseId, productId: { in: data.items.map((i) => i.productId) } },
      include: { product: true },
    });
    const stockMap = new Map(stockRows.map((s) => [s.productId, s]));

    for (const item of data.items) {
      const stock = stockMap.get(item.productId);
      if (!stock || stock.damagedQuantity < item.qty) {
        const name = stock?.product.name ?? `product ${item.productId}`;
        throw new ApiError(
          400,
          `Cannot return ${item.qty} of "${name}" to supplier — only ${stock?.damagedQuantity ?? 0} marked damaged at this warehouse`
        );
      }
    }

    const returnNumber = await generateSupplierReturnNumber(tx);
    const created = await tx.supplierReturn.create({
      data: {
        returnNumber,
        supplierId: data.supplierId,
        warehouseId: data.warehouseId,
        createdById: actor.id,
        items: { create: data.items.map((i) => ({ productId: i.productId, qty: i.qty })) },
      },
      include: { items: { include: { product: true } }, supplier: true, warehouse: true },
    });

    for (const item of data.items) {
      const stock = stockMap.get(item.productId)!;
      // Reduce the transit-sourced subset by the same amount (clamped at 0)
      // so it can never end up larger than the new total — a return doesn't
      // ask which source the returned units came from, so transit-sourced
      // units are treated as returned first.
      const newDamagedQuantityTransit = Math.max(0, stock.damagedQuantityTransit - item.qty);
      await tx.stock.update({
        where: { id: stock.id },
        data: { damagedQuantity: stock.damagedQuantity - item.qty, damagedQuantityTransit: newDamagedQuantityTransit },
      });
    }

    await recordAudit(tx, {
      userId: actor.id,
      action: "SUPPLIER_RETURN",
      entityType: "SupplierReturn",
      entityId: created.id,
      metadata: {
        returnNumber: created.returnNumber,
        warehouseId: data.warehouseId,
        warehouseName: created.warehouse.name,
        items: created.items.map((i) => ({ productId: i.productId, productName: i.product.name, qty: i.qty })),
      },
    });

    return created;
  });

  res.status(201).json(supplierReturn);
});

export const listSupplierReturns = asyncHandler(async (_req: Request, res: Response) => {
  const returns = await prisma.supplierReturn.findMany({
    include: { supplier: true, warehouse: true, items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(returns);
});

export const getSupplierReturn = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const supplierReturn = await prisma.supplierReturn.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, supplier: true, warehouse: true },
  });
  if (!supplierReturn) throw new ApiError(404, "Supplier return not found");
  res.json(supplierReturn);
});
