import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/asyncHandler";

export const listSuppliers = asyncHandler(async (req: Request, res: Response) => {
  const search = String(req.query.search ?? "").trim();
  const suppliers = await prisma.supplier.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : undefined,
    orderBy: { id: "desc" },
    take: 50,
  });
  res.json(suppliers);
});

const createSupplierSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  const data = createSupplierSchema.parse(req.body);
  const supplier = await prisma.supplier.create({
    data: {
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
    },
  });
  res.status(201).json(supplier);
});
