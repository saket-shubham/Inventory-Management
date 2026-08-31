import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { recordAudit } from "../services/auditLog";

// Never send passwordHash to the client — every handler below selects fields explicitly.
const userSummarySelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
} as const;

export const listUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: userSummarySelect,
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const user = await prisma.user.findUnique({ where: { id }, select: userSummarySelect });
  if (!user) throw new ApiError(404, "User not found");

  const activity = await prisma.auditLog.findMany({
    where: { userId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json({ user, activity });
});

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const data = createUserSchema.parse(req.body);
  const actor = req.user!;
  const email = data.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError(409, "A user with this email already exists");

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.$transaction(async (tx) => {
    // Role is always "staff" here — creating additional admins isn't exposed
    // through this form (see the discussion at the end of this feature).
    const created = await tx.user.create({
      data: { name: data.name, email, passwordHash, role: "staff" },
      select: userSummarySelect,
    });

    await recordAudit(tx, {
      userId: actor.id,
      action: "STAFF_CREATED",
      entityType: "User",
      entityId: created.id,
      metadata: { name: created.name, email: created.email },
    });

    return created;
  });

  res.status(201).json(user);
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["admin", "staff"]).optional(),
  isActive: z.boolean().optional(),
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const data = updateUserSchema.parse(req.body);
  const actor = req.user!;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "User not found");

  // Guard against an admin locking themselves out: they can't deactivate
  // their own account or demote themselves away from admin.
  if (actor.id === id) {
    if (data.isActive === false) throw new ApiError(400, "You cannot deactivate your own account");
    if (data.role === "staff") throw new ApiError(400, "You cannot remove your own admin role");
  }

  const email = data.email?.toLowerCase();
  if (email && email !== existing.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) throw new ApiError(409, "A user with this email already exists");
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.password !== undefined ? { passwordHash: await bcrypt.hash(data.password, 10) } : {}),
      },
      select: userSummarySelect,
    });

    if (data.isActive !== undefined && data.isActive !== existing.isActive) {
      await recordAudit(tx, {
        userId: actor.id,
        action: data.isActive ? "STAFF_ACTIVATED" : "STAFF_DEACTIVATED",
        entityType: "User",
        entityId: id,
        metadata: { name: updated.name, email: updated.email },
      });
    } else {
      await recordAudit(tx, {
        userId: actor.id,
        action: "STAFF_UPDATED",
        entityType: "User",
        entityId: id,
        metadata: { name: updated.name, email: updated.email, changes: Object.keys(data) },
      });
    }

    return updated;
  });

  res.json(user);
});
