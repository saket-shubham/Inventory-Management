import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { recordAudit } from "../services/auditLog";

const adjustSchema = z.object({
  productId: z.number().int(),
  warehouseId: z.number().int(),
  changeQty: z.number().int().refine((n) => n !== 0, "changeQty must not be zero"),
  reorderLevel: z.number().int().nonnegative().optional(),
  reason: z.string().trim().min(1).optional(),
});

export const adjustStock = asyncHandler(async (req: Request, res: Response) => {
  const data = adjustSchema.parse(req.body);
  const actor = req.user!;

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.stock.findUnique({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.warehouseId } },
      include: { product: true, warehouse: true },
    });

    const previousQty = existing?.quantity ?? 0;
    const newQty = previousQty + data.changeQty;
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
      include: { product: true, warehouse: true },
    });

    await tx.stockLedger.create({
      data: {
        productId: data.productId,
        warehouseId: data.warehouseId,
        changeQty: data.changeQty,
        previousQty,
        balanceQty: newQty,
        referenceType: "adjustment",
        performedById: actor.id,
        reason: data.reason,
      },
    });

    await recordAudit(tx, {
      userId: actor.id,
      action: "STOCK_ADJUSTMENT",
      entityType: "Product",
      entityId: data.productId,
      metadata: {
        productName: stock.product.name,
        warehouseId: data.warehouseId,
        warehouseName: stock.warehouse.name,
        previousQty,
        changeQty: data.changeQty,
        newQty,
        reason: data.reason ?? null,
      },
    });

    return stock;
  });

  res.json(result);
});

const transferSchema = z.object({
  productId: z.number().int(),
  fromWarehouseId: z.number().int(),
  toWarehouseId: z.number().int(),
  qty: z.number().int().positive(),
  reason: z.string().trim().min(1).optional(),
});

export const transferStock = asyncHandler(async (req: Request, res: Response) => {
  const data = transferSchema.parse(req.body);
  const actor = req.user!;

  if (data.fromWarehouseId === data.toWarehouseId) {
    throw new ApiError(400, "Source and destination warehouse must differ");
  }

  const result = await prisma.$transaction(async (tx) => {
    const [product, fromWarehouse, toWarehouse] = await Promise.all([
      tx.product.findUnique({ where: { id: data.productId } }),
      tx.warehouse.findUnique({ where: { id: data.fromWarehouseId } }),
      tx.warehouse.findUnique({ where: { id: data.toWarehouseId } }),
    ]);
    if (!product) throw new ApiError(404, "Product not found");
    if (!fromWarehouse || !toWarehouse) throw new ApiError(404, "Warehouse not found");

    const fromStock = await tx.stock.findUnique({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.fromWarehouseId } },
    });
    const fromPreviousQty = fromStock?.quantity ?? 0;
    if (fromPreviousQty < data.qty) {
      throw new ApiError(
        400,
        `Insufficient stock at "${fromWarehouse.name}" (available: ${fromPreviousQty}, requested: ${data.qty})`
      );
    }
    const fromNewQty = fromPreviousQty - data.qty;

    const toStock = await tx.stock.findUnique({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.toWarehouseId } },
    });
    const toPreviousQty = toStock?.quantity ?? 0;
    const toNewQty = toPreviousQty + data.qty;

    await tx.stock.update({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.fromWarehouseId } },
      data: { quantity: fromNewQty },
    });
    await tx.stock.upsert({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.toWarehouseId } },
      update: { quantity: toNewQty },
      create: { productId: data.productId, warehouseId: data.toWarehouseId, quantity: toNewQty, reorderLevel: 0 },
    });

    const transfer = await tx.stockTransfer.create({
      data: {
        productId: data.productId,
        fromWarehouseId: data.fromWarehouseId,
        toWarehouseId: data.toWarehouseId,
        qty: data.qty,
        fromPreviousQty,
        fromNewQty,
        toPreviousQty,
        toNewQty,
        performedById: actor.id,
        reason: data.reason,
      },
    });

    await tx.stockLedger.createMany({
      data: [
        {
          productId: data.productId,
          warehouseId: data.fromWarehouseId,
          changeQty: -data.qty,
          previousQty: fromPreviousQty,
          balanceQty: fromNewQty,
          referenceType: "transfer",
          referenceId: transfer.id,
          performedById: actor.id,
          reason: data.reason,
        },
        {
          productId: data.productId,
          warehouseId: data.toWarehouseId,
          changeQty: data.qty,
          previousQty: toPreviousQty,
          balanceQty: toNewQty,
          referenceType: "transfer",
          referenceId: transfer.id,
          performedById: actor.id,
          reason: data.reason,
        },
      ],
    });

    await recordAudit(tx, {
      userId: actor.id,
      action: "STOCK_TRANSFER",
      entityType: "StockTransfer",
      entityId: transfer.id,
      metadata: {
        productName: product.name,
        fromWarehouseId: data.fromWarehouseId,
        fromWarehouseName: fromWarehouse.name,
        toWarehouseId: data.toWarehouseId,
        toWarehouseName: toWarehouse.name,
        qty: data.qty,
        fromPreviousQty,
        fromNewQty,
        toPreviousQty,
        toNewQty,
        reason: data.reason ?? null,
      },
    });

    return transfer;
  });

  res.status(201).json(result);
});

const markDamagedSchema = z.object({
  productId: z.number().int(),
  warehouseId: z.number().int(),
  qty: z.number().int().positive(),
});

export const markDamaged = asyncHandler(async (req: Request, res: Response) => {
  const data = markDamagedSchema.parse(req.body);
  const actor = req.user!;

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.stock.findUnique({
      where: { productId_warehouseId: { productId: data.productId, warehouseId: data.warehouseId } },
      include: { product: true, warehouse: true },
    });

    if (!existing || existing.quantity < data.qty) {
      throw new ApiError(
        400,
        `Cannot mark ${data.qty} as damaged — only ${existing?.quantity ?? 0} sellable units available at this warehouse`
      );
    }

    const previousQty = existing.quantity;
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
        previousQty,
        balanceQty: newQty,
        referenceType: "adjustment",
        performedById: actor.id,
        reason: "Marked damaged",
      },
    });

    await recordAudit(tx, {
      userId: actor.id,
      action: "DAMAGE",
      entityType: "Product",
      entityId: data.productId,
      metadata: {
        productName: existing.product.name,
        warehouseId: data.warehouseId,
        warehouseName: existing.warehouse.name,
        qty: data.qty,
        previousQty,
        newQty,
        damageSource: "showroom",
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

// Damage Source is derived, not stored per-row: Stock.damagedQuantityTransit
// is the Damage on Transit subset of the existing Stock.damagedQuantity
// total; the remainder is Damage on Showroom (mark-damaged, defective
// customer/hold returns — everything that happened once the unit was already
// in showroom/shop inventory). One Stock row can therefore surface as up to
// two rows here, one per non-zero source — matching the existing damaged
// stock list, just split out instead of collapsed into a single number.
export const listDamagedStock = asyncHandler(async (req: Request, res: Response) => {
  const sourceFilter = req.query.source === "transit" || req.query.source === "showroom" ? req.query.source : undefined;

  const rows = await prisma.stock.findMany({
    where: { damagedQuantity: { gt: 0 } },
    include: { product: true, warehouse: true },
    orderBy: { updatedAt: "desc" },
  });

  const result: Array<{
    productId: number;
    productName: string;
    sku: string;
    warehouseId: number;
    warehouseName: string;
    damagedQuantity: number;
    damageSource: "transit" | "showroom";
    updatedAt: Date;
  }> = [];

  for (const s of rows) {
    const transitQty = s.damagedQuantityTransit;
    const showroomQty = s.damagedQuantity - s.damagedQuantityTransit;

    if (transitQty > 0 && (!sourceFilter || sourceFilter === "transit")) {
      result.push({
        productId: s.productId,
        productName: s.product.name,
        sku: s.product.sku,
        warehouseId: s.warehouseId,
        warehouseName: s.warehouse.name,
        damagedQuantity: transitQty,
        damageSource: "transit",
        updatedAt: s.updatedAt,
      });
    }
    if (showroomQty > 0 && (!sourceFilter || sourceFilter === "showroom")) {
      result.push({
        productId: s.productId,
        productName: s.product.name,
        sku: s.product.sku,
        warehouseId: s.warehouseId,
        warehouseName: s.warehouse.name,
        damagedQuantity: showroomQty,
        damageSource: "showroom",
        updatedAt: s.updatedAt,
      });
    }
  }

  res.json(result);
});
