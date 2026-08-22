import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

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
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
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
  unit: z.string().default("pcs"),
  initialStock: z
    .array(z.object({ warehouseId: z.number().int(), quantity: z.number().int().nonnegative(), reorderLevel: z.number().int().nonnegative().default(0) }))
    .optional(),
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const data = createProductSchema.parse(req.body);

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
  unit: z.string().default("pcs"),
  initialStock: z.number().int().nonnegative().optional(),
});

const bulkProductsSchema = z.object({
  warehouseId: z.number().int().optional(),
  products: z.array(bulkProductRowSchema).min(1, "Add at least one product row"),
});

export const createProductsBulk = asyncHandler(async (req: Request, res: Response) => {
  const data = bulkProductsSchema.parse(req.body);

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
            unit: item.unit,
          },
        });

        if (data.warehouseId && item.initialStock) {
          await tx.stock.create({
            data: {
              productId: created.id,
              warehouseId: data.warehouseId,
              quantity: item.initialStock,
              reorderLevel: 0,
            },
          });
        }

        return created;
      });

      results.push({ index: i, success: true, product });
    } catch (err) {
      results.push({ index: i, success: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
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
  unit: z.string().optional(),
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const data = updateProductSchema.parse(req.body);

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Product not found");

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...data,
      ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl || null } : {}),
    },
  });

  res.json(product);
});
