import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/asyncHandler";

export const listWarehouses = asyncHandler(async (_req: Request, res: Response) => {
  const warehouses = await prisma.warehouse.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  res.json(warehouses);
});
