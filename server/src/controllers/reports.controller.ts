import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/asyncHandler";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const getSalesSummary = asyncHandler(async (_req: Request, res: Response) => {
  const today = startOfToday();
  const monthStart = startOfMonth();
  const notCancelled = { status: { not: "cancelled" as const } };

  const [todayAgg, monthAgg, topItems, warehouseAgg, warehouses] = await Promise.all([
    prisma.invoice.aggregate({
      where: { ...notCancelled, createdAt: { gte: today } },
      _sum: { grandTotal: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { ...notCancelled, createdAt: { gte: monthStart } },
      _sum: { grandTotal: true },
      _count: true,
    }),
    prisma.invoiceItem.groupBy({
      by: ["productId"],
      where: { invoice: { ...notCancelled, createdAt: { gte: monthStart } } },
      _sum: { qty: true },
      orderBy: { _sum: { qty: "desc" } },
      take: 5,
    }),
    prisma.invoice.groupBy({
      by: ["warehouseId"],
      where: { ...notCancelled, createdAt: { gte: monthStart } },
      _sum: { grandTotal: true },
    }),
    prisma.warehouse.findMany(),
  ]);

  const products = await prisma.product.findMany({
    where: { id: { in: topItems.map((i) => i.productId) } },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

  res.json({
    today: { totalSales: todayAgg._sum.grandTotal ?? 0, invoiceCount: todayAgg._count },
    thisMonth: { totalSales: monthAgg._sum.grandTotal ?? 0, invoiceCount: monthAgg._count },
    topProducts: topItems.map((i) => ({
      productId: i.productId,
      productName: productMap.get(i.productId)?.name ?? "Unknown",
      sku: productMap.get(i.productId)?.sku ?? "",
      qtySold: i._sum.qty ?? 0,
    })),
    salesByWarehouse: warehouseAgg.map((w) => ({
      warehouseId: w.warehouseId,
      warehouseName: warehouseMap.get(w.warehouseId)?.name ?? "Unknown",
      totalSales: w._sum.grandTotal ?? 0,
    })),
  });
});
