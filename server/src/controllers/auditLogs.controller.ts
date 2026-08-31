import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/asyncHandler";

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const { userId, action, entityType, entityId, from, to } = req.query;

  const where: Prisma.AuditLogWhereInput = {};
  if (userId) where.userId = Number(userId);
  if (action) where.action = String(action);
  if (entityType) where.entityType = String(entityType);
  if (entityId) where.entityId = Number(entityId);
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(String(from)) } : {}),
      ...(to ? { lte: new Date(String(to)) } : {}),
    };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  res.json(logs);
});
