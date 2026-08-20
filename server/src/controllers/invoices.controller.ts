import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { generateInvoiceNumber } from "../services/invoiceNumber";
import { streamInvoicePdf } from "../services/pdfService";

const createInvoiceSchema = z.object({
  warehouseId: z.number().int(),
  customerId: z.number().int().optional(),
  paymentMode: z.enum(["cash", "card", "upi"]),
  discount: z.number().nonnegative().default(0),
  items: z
    .array(
      z.object({
        productId: z.number().int(),
        qty: z.number().int().positive(),
        barcodeScanned: z.string().optional(),
      })
    )
    .min(1, "Cart must contain at least one item"),
});

export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  const data = createInvoiceSchema.parse(req.body);

  const invoice = await prisma.$transaction(async (tx) => {
    const productIds = data.items.map((i) => i.productId);
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of data.items) {
      if (!productMap.has(item.productId)) {
        throw new ApiError(400, `Product ${item.productId} not found`);
      }
    }

    const stockRows = await tx.stock.findMany({
      where: { warehouseId: data.warehouseId, productId: { in: productIds } },
    });
    const stockMap = new Map(stockRows.map((s) => [s.productId, s]));

    for (const item of data.items) {
      const stock = stockMap.get(item.productId);
      if (!stock || stock.quantity < item.qty) {
        const product = productMap.get(item.productId)!;
        throw new ApiError(
          400,
          `Insufficient stock for "${product.name}" at the selected warehouse (available: ${stock?.quantity ?? 0}, requested: ${item.qty})`
        );
      }
    }

    let subtotal = new Prisma.Decimal(0);
    let taxAmount = new Prisma.Decimal(0);
    const itemsData = data.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const price = product.sellingPrice;
      const lineBase = price.mul(item.qty);
      const lineTax = lineBase.mul(product.taxPercent).div(100);
      const lineTotal = lineBase.add(lineTax);
      subtotal = subtotal.add(lineBase);
      taxAmount = taxAmount.add(lineTax);
      return {
        productId: product.id,
        barcodeScanned: item.barcodeScanned ?? product.barcode,
        qty: item.qty,
        mrp: product.mrp,
        price,
        taxAmount: lineTax,
        lineTotal,
      };
    });

    const discount = new Prisma.Decimal(data.discount);
    const grandTotal = subtotal.add(taxAmount).sub(discount);
    if (grandTotal.isNegative()) {
      throw new ApiError(400, "Discount cannot exceed subtotal plus tax");
    }

    const invoiceNumber = await generateInvoiceNumber(tx);

    const created = await tx.invoice.create({
      data: {
        invoiceNumber,
        customerId: data.customerId,
        warehouseId: data.warehouseId,
        subtotal,
        taxAmount,
        discount,
        grandTotal,
        paymentMode: data.paymentMode,
        status: "paid",
        items: { create: itemsData },
      },
      include: { items: true, customer: true, warehouse: true },
    });

    for (const item of data.items) {
      const stock = stockMap.get(item.productId)!;
      const newQty = stock.quantity - item.qty;
      await tx.stock.update({
        where: { id: stock.id },
        data: { quantity: newQty },
      });
      await tx.stockLedger.create({
        data: {
          productId: item.productId,
          warehouseId: data.warehouseId,
          changeQty: -item.qty,
          balanceQty: newQty,
          referenceType: "invoice",
          referenceId: created.id,
        },
      });
    }

    return created;
  });

  res.status(201).json(invoice);
});

export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, customer: true, warehouse: true },
  });
  if (!invoice) throw new ApiError(404, "Invoice not found");
  res.json(invoice);
});

export const listInvoices = asyncHandler(async (req: Request, res: Response) => {
  const { from, to, customer, product, invoiceNumber } = req.query;

  const where: Prisma.InvoiceWhereInput = {};
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(String(from)) } : {}),
      ...(to ? { lte: new Date(String(to)) } : {}),
    };
  }
  if (invoiceNumber) {
    where.invoiceNumber = { contains: String(invoiceNumber) };
  }
  if (customer) {
    where.customer = {
      OR: [
        { name: { contains: String(customer) } },
        { phone: { contains: String(customer) } },
      ],
    };
  }
  if (product) {
    where.items = { some: { product: { name: { contains: String(product) } } } };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: { customer: true, warehouse: true, items: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  res.json(invoices);
});

export const downloadInvoicePdf = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, customer: true, warehouse: true },
  });
  if (!invoice) throw new ApiError(404, "Invoice not found");

  streamInvoicePdf(res, {
    invoiceNumber: invoice.invoiceNumber,
    createdAt: invoice.createdAt,
    paymentMode: invoice.paymentMode,
    subtotal: Number(invoice.subtotal),
    taxAmount: Number(invoice.taxAmount),
    discount: Number(invoice.discount),
    grandTotal: Number(invoice.grandTotal),
    customer: invoice.customer
      ? { name: invoice.customer.name, phone: invoice.customer.phone, gstNumber: invoice.customer.gstNumber }
      : null,
    warehouse: { name: invoice.warehouse.name, location: invoice.warehouse.location },
    items: invoice.items.map((item) => ({
      product: { name: item.product.name, sku: item.product.sku },
      qty: item.qty,
      mrp: Number(item.mrp),
      price: Number(item.price),
      taxAmount: Number(item.taxAmount),
      lineTotal: Number(item.lineTotal),
    })),
  });
});
