import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { recordAudit } from "../services/auditLog";

const MAX_IMAGE_BYTES = 50 * 1024;

// A data URI's decoded byte size is ~3/4 of its base64 payload length.
function base64ByteSize(dataUri: string): number {
  const base64 = dataUri.slice(dataUri.indexOf(",") + 1);
  return Math.ceil((base64.length * 3) / 4);
}

// Camera-captured/uploaded images arrive as a compressed base64 data URI —
// validated here so a request can never persist something that isn't really
// an image, or that snuck past the client-side 50KB compression.
const imageDataSchema = z
  .string()
  .regex(/^data:image\/(jpeg|jpg|png|webp);base64,/, "Image must be a JPEG, PNG, or WebP data URI")
  .refine((val) => base64ByteSize(val) <= MAX_IMAGE_BYTES, `Image must be ${MAX_IMAGE_BYTES / 1024}KB or smaller`)
  .optional()
  .or(z.literal(""));

export const lookupByBarcode = asyncHandler(async (req: Request, res: Response) => {
  const barcode = String(req.query.barcode ?? "").trim();
  if (!barcode) throw new ApiError(400, "barcode query param is required");

  const product = await prisma.product.findUnique({
    where: { barcode },
    include: {
      stock: {
        include: { warehouse: true },
      },
    },
  });

  if (!product || !product.isActive) {
    throw new ApiError(404, "Product not found for this barcode");
  }

  res.json({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    category: product.category,
    brand: product.brand,
    mrp: product.mrp,
    sellingPrice: product.sellingPrice,
    taxPercent: product.taxPercent,
    imageUrl: product.imageUrl,
    imageData: product.imageData,
    unit: product.unit,
    stockByWarehouse: product.stock.map((s) => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      location: s.warehouse.location,
      quantity: s.quantity,
      reorderLevel: s.reorderLevel,
      lowStock: s.quantity <= s.reorderLevel,
    })),
  });
});

export const getProductStock = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const stock = await prisma.stock.findMany({
    where: { productId: id },
    include: { warehouse: true },
  });
  if (stock.length === 0) {
    const exists = await prisma.product.findUnique({ where: { id } });
    if (!exists) throw new ApiError(404, "Product not found");
  }
  res.json(
    stock.map((s) => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      quantity: s.quantity,
      damagedQuantity: s.damagedQuantity,
      reorderLevel: s.reorderLevel,
      lowStock: s.quantity <= s.reorderLevel,
    }))
  );
});

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const search = String(req.query.search ?? "").trim();
  const includeInactive = req.query.includeInactive === "true";
  const products = await prisma.product.findMany({
    where: {
      ...(includeInactive ? {} : { isActive: true }),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { sku: { contains: search } },
              { barcode: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(products);
});

const createProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  barcode: z.string().min(1),
  category: z.string().optional(),
  brand: z.string().optional(),
  mrp: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  taxPercent: z.number().min(0).max(100).default(0),
  imageUrl: z.string().url().optional().or(z.literal("")),
  imageData: imageDataSchema,
  unit: z.string().default("pcs"),
  initialStock: z
    .array(z.object({ warehouseId: z.number().int(), quantity: z.number().int().nonnegative(), reorderLevel: z.number().int().nonnegative().default(0) }))
    .optional(),
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const data = createProductSchema.parse(req.body);
  const actor = req.user!;

  const existing = await prisma.product.findUnique({ where: { barcode: data.barcode } });
  if (existing) throw new ApiError(409, "A product with this barcode already exists");

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        name: data.name,
        sku: data.sku,
        barcode: data.barcode,
        category: data.category,
        brand: data.brand,
        mrp: data.mrp,
        sellingPrice: data.sellingPrice,
        taxPercent: data.taxPercent,
        imageUrl: data.imageUrl || null,
        imageData: data.imageData || null,
        unit: data.unit,
      },
    });

    if (data.initialStock?.length) {
      await tx.stock.createMany({
        data: data.initialStock.map((s) => ({
          productId: created.id,
          warehouseId: s.warehouseId,
          quantity: s.quantity,
          reorderLevel: s.reorderLevel,
        })),
      });
    }

    await recordAudit(tx, {
      userId: actor.id,
      action: "PRODUCT_CREATED",
      entityType: "Product",
      entityId: created.id,
      metadata: { name: created.name, sku: created.sku, barcode: created.barcode },
    });

    return created;
  });

  res.status(201).json(product);
});

const bulkProductRowSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  barcode: z.string().min(1),
  category: z.string().optional(),
  brand: z.string().optional(),
  mrp: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  taxPercent: z.number().min(0).max(100).default(0),
  imageUrl: z.string().url().optional().or(z.literal("")),
  imageData: imageDataSchema,
  unit: z.string().default("pcs"),
  initialStock: z
    .array(z.object({ warehouseId: z.number().int(), quantity: z.number().int().nonnegative() }))
    .optional(),
});

const bulkProductsSchema = z.object({
  products: z.array(bulkProductRowSchema).min(1, "Add at least one product row"),
});

export const createProductsBulk = asyncHandler(async (req: Request, res: Response) => {
  const data = bulkProductsSchema.parse(req.body);
  const actor = req.user!;

  const existingCount = await prisma.product.count();
  let nextSkuSeq = existingCount + 1;

  const seenBarcodes = new Set<string>();
  const seenSkus = new Set<string>();
  const results: Array<
    { index: number; success: true; product: Awaited<ReturnType<typeof prisma.product.create>> } | { index: number; success: false; error: string }
  > = [];

  for (let i = 0; i < data.products.length; i++) {
    const item = data.products[i];
    try {
      if (seenBarcodes.has(item.barcode)) {
        throw new Error(`Duplicate barcode "${item.barcode}" within this batch`);
      }
      const existingBarcode = await prisma.product.findUnique({ where: { barcode: item.barcode } });
      if (existingBarcode) {
        throw new Error(`Barcode "${item.barcode}" already exists`);
      }
      seenBarcodes.add(item.barcode);

      let sku = item.sku?.trim();
      if (sku) {
        if (seenSkus.has(sku)) throw new Error(`Duplicate SKU "${sku}" within this batch`);
        const existingSku = await prisma.product.findUnique({ where: { sku } });
        if (existingSku) throw new Error(`SKU "${sku}" already exists`);
      } else {
        do {
          sku = `SKU-${String(nextSkuSeq).padStart(4, "0")}`;
          nextSkuSeq++;
        } while (seenSkus.has(sku));
      }
      seenSkus.add(sku);

      const product = await prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            name: item.name,
            sku: sku!,
            barcode: item.barcode,
            category: item.category,
            brand: item.brand,
            mrp: item.mrp,
            sellingPrice: item.sellingPrice,
            taxPercent: item.taxPercent,
            imageUrl: item.imageUrl || null,
            imageData: item.imageData || null,
            unit: item.unit,
          },
        });

        if (item.initialStock?.length) {
          await tx.stock.createMany({
            data: item.initialStock.map((s) => ({
              productId: created.id,
              warehouseId: s.warehouseId,
              quantity: s.quantity,
              reorderLevel: 0,
            })),
          });
        }

        return created;
      });

      results.push({ index: i, success: true, product });
    } catch (err) {
      results.push({ index: i, success: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  const succeeded = results.filter((r) => r.success);
  if (succeeded.length > 0) {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "PRODUCT_CREATED",
        entityType: "Product",
        metadata: { bulk: true, count: succeeded.length },
      },
    });
  }

  res.json({ results });
});

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  mrp: z.number().nonnegative().optional(),
  sellingPrice: z.number().nonnegative().optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  imageData: imageDataSchema,
  unit: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const data = updateProductSchema.parse(req.body);
  const actor = req.user!;

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Product not found");

  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id },
      data: {
        ...data,
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl || null } : {}),
        ...(data.imageData !== undefined ? { imageData: data.imageData || null } : {}),
      },
    });

    if (data.isActive !== undefined && data.isActive !== existing.isActive) {
      await recordAudit(tx, {
        userId: actor.id,
        action: data.isActive ? "PRODUCT_ACTIVATED" : "PRODUCT_DEACTIVATED",
        entityType: "Product",
        entityId: id,
        metadata: { name: updated.name, sku: updated.sku },
      });
    } else {
      await recordAudit(tx, {
        userId: actor.id,
        action: "PRODUCT_UPDATED",
        entityType: "Product",
        entityId: id,
        metadata: { name: updated.name, sku: updated.sku, changes: Object.keys(data) },
      });
    }

    return updated;
  });

  res.json(product);
});
