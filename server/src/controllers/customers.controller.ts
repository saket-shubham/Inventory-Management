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

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(customer);
});

const createCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  gstNumber: z.string().optional(),
  address: z.string().optional(),
});

// The billing form is the source of customer data (per the Customer
// Management feature): this endpoint is called every time a name/phone is
// entered while billing, so it upserts by phone (the WhatsApp/mobile number
// — the one identifier billing always has) rather than blindly creating a
// row every time, and updates an existing customer's details with whatever
// new information was just typed in rather than leaving it stale.
export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const data = createCustomerSchema.parse(req.body);
  const phone = data.phone?.trim() || null;

  const fields = {
    name: data.name,
    ...(data.email ? { email: data.email } : {}),
    ...(data.gstNumber ? { gstNumber: data.gstNumber } : {}),
    ...(data.address ? { address: data.address } : {}),
  };

  if (phone) {
    const customer = await prisma.customer.upsert({
      where: { phone },
      update: fields,
      create: { ...fields, phone },
    });
    res.status(201).json(customer);
    return;
  }

  // No phone given — nothing to dedupe against, just create a fresh record
  // (e.g. a walk-in customer who only gives a name).
  const customer = await prisma.customer.create({ data: fields });
  res.status(201).json(customer);
});
