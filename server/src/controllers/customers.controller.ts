import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/asyncHandler";

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const search = String(req.query.search ?? "").trim();
  const customers = await prisma.customer.findMany({
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
  res.json(customers);
});

const createCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  gstNumber: z.string().optional(),
  address: z.string().optional(),
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const data = createCustomerSchema.parse(req.body);
  const customer = await prisma.customer.create({
    data: {
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      gstNumber: data.gstNumber || null,
      address: data.address || null,
    },
  });
  res.status(201).json(customer);
});
