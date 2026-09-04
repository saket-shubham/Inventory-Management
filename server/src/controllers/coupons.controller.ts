import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

export const listCoupons = asyncHandler(async (_req: Request, res: Response) => {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  res.json(coupons);
});

// Used by the billing screen to look up a code the cashier typed in, before
// the invoice is actually created. The real, authoritative check happens
// again server-side inside createInvoice — this is just for live feedback.
export const validateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const code = String(req.query.code ?? "").trim();
  if (!code) throw new ApiError(400, "code query param is required");

  const coupon = await prisma.coupon.findFirst({
    where: { code: { equals: code, mode: "insensitive" }, isActive: true },
  });
  if (!coupon) throw new ApiError(404, "Invalid or inactive coupon code");

  res.json({ code: coupon.code, discountPercent: coupon.discountPercent });
});

const createCouponSchema = z.object({
  code: z.string().trim().min(1),
  discountPercent: z.number().positive().max(100),
});

export const createCoupon = asyncHandler(async (req: Request, res: Response) => {
  const data = createCouponSchema.parse(req.body);

  const existing = await prisma.coupon.findFirst({ where: { code: { equals: data.code, mode: "insensitive" } } });
  if (existing) throw new ApiError(409, "A coupon with this code already exists");

  const coupon = await prisma.coupon.create({
    data: { code: data.code, discountPercent: data.discountPercent },
  });
  res.status(201).json(coupon);
});

const updateCouponSchema = z.object({
  discountPercent: z.number().positive().max(100).optional(),
  isActive: z.boolean().optional(),
});

export const updateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const data = updateCouponSchema.parse(req.body);

  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Coupon not found");

  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      ...(data.discountPercent !== undefined ? { discountPercent: data.discountPercent } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
  res.json(coupon);
});
