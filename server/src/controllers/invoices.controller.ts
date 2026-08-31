import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { generateInvoiceNumber } from "../services/invoiceNumber";
import { generateReturnNumber } from "../services/returnNumber";
import { streamInvoicePdf } from "../services/pdfService";
import { recordAudit } from "../services/auditLog";

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
        discount: z.number().nonnegative().default(0),
      })
    )
    .min(1, "Cart must contain at least one item"),
});

export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  const data = createInvoiceSchema.parse(req.body);
  const actor = req.user!;

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
      // Item discount is a rupee amount, clamped so it can't exceed the line's own base price.
      const itemDiscount = Prisma.Decimal.min(new Prisma.Decimal(item.discount), lineBase);
      const discountedBase = lineBase.sub(itemDiscount);
      const lineTax = discountedBase.mul(product.taxPercent).div(100);
      const lineTotal = discountedBase.add(lineTax);
      subtotal = subtotal.add(discountedBase);
      taxAmount = taxAmount.add(lineTax);
      return {
        productId: product.id,
        barcodeScanned: item.barcodeScanned ?? product.barcode,
        qty: item.qty,
        mrp: product.mrp,
        price,
        discount: itemDiscount,
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
        createdById: actor.id,
        items: { create: itemsData },
      },
      include: { items: true, customer: true, warehouse: true },
    });

    for (const item of data.items) {
      const stock = stockMap.get(item.productId)!;
      const previousQty = stock.quantity;
      const newQty = previousQty - item.qty;
      await tx.stock.update({
        where: { id: stock.id },
        data: { quantity: newQty },
      });
      await tx.stockLedger.create({
        data: {
          productId: item.productId,
          warehouseId: data.warehouseId,
          changeQty: -item.qty,
          previousQty,
          balanceQty: newQty,
          referenceType: "invoice",
          referenceId: created.id,
          performedById: actor.id,
        },
      });
    }

    await recordAudit(tx, {
      userId: actor.id,
      action: "SALE",
      entityType: "Invoice",
      entityId: created.id,
      metadata: { invoiceNumber: created.invoiceNumber, warehouseId: data.warehouseId, grandTotal: grandTotal.toString(), itemCount: data.items.length },
    });

    return created;
  });

  res.status(201).json(invoice);
});

export const cancelInvoice = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const actor = req.user!;

  const updated = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id }, include: { items: true } });
    if (!invoice) throw new ApiError(404, "Invoice not found");
    if (invoice.status !== "paid") {
      throw new ApiError(400, `Invoice is already ${invoice.status}, cannot cancel`);
    }

    for (const item of invoice.items) {
      const stock = await tx.stock.findUnique({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: invoice.warehouseId } },
      });
      const previousQty = stock?.quantity ?? 0;
      const newQty = previousQty + item.qty;

      await tx.stock.upsert({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: invoice.warehouseId } },
        update: { quantity: newQty },
        create: { productId: item.productId, warehouseId: invoice.warehouseId, quantity: newQty, reorderLevel: 0 },
      });

      await tx.stockLedger.create({
        data: {
          productId: item.productId,
          warehouseId: invoice.warehouseId,
          changeQty: item.qty,
          previousQty,
          balanceQty: newQty,
          referenceType: "invoice",
          referenceId: invoice.id,
          performedById: actor.id,
          reason: "Invoice cancelled",
        },
      });
    }

    const result = await tx.invoice.update({
      where: { id },
      data: { status: "cancelled" },
      include: { items: { include: { product: true } }, customer: true, warehouse: true },
    });

    await recordAudit(tx, {
      userId: actor.id,
      action: "INVOICE_CANCELLED",
      entityType: "Invoice",
      entityId: invoice.id,
      metadata: { invoiceNumber: invoice.invoiceNumber, warehouseId: invoice.warehouseId },
    });

    return result;
  });

  res.json(updated);
});

const createReturnSchema = z.object({
  items: z
    .array(
      z.object({
        invoiceItemId: z.number().int(),
        qty: z.number().int().positive(),
        reason: z.enum(["normal", "defective"]),
      })
    )
    .min(1, "Select at least one item to return"),
});

export const createReturn = asyncHandler(async (req: Request, res: Response) => {
  const invoiceId = Number(req.params.id);
  const data = createReturnSchema.parse(req.body);
  const actor = req.user!;

  const created = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: { include: { product: true } } },
    });
    if (!invoice) throw new ApiError(404, "Invoice not found");
    if (invoice.status !== "paid") {
      throw new ApiError(400, `Invoice is ${invoice.status}, cannot process a return against it`);
    }

    const invoiceItemMap = new Map(invoice.items.map((i) => [i.id, i]));
    let totalRefund = new Prisma.Decimal(0);

    const itemsData = data.items.map((reqItem) => {
      const invoiceItem = invoiceItemMap.get(reqItem.invoiceItemId);
      if (!invoiceItem) {
        throw new ApiError(400, `Invoice item ${reqItem.invoiceItemId} does not belong to this invoice`);
      }
      const returnable = invoiceItem.qty - invoiceItem.returnedQty;
      if (reqItem.qty > returnable) {
        throw new ApiError(
          400,
          `Cannot return ${reqItem.qty} of "${invoiceItem.product.name}" — only ${returnable} left returnable`
        );
      }
      const refundAmount = invoiceItem.lineTotal.div(invoiceItem.qty).mul(reqItem.qty);
      totalRefund = totalRefund.add(refundAmount);
      return {
        invoiceItemId: invoiceItem.id,
        productId: invoiceItem.productId,
        qty: reqItem.qty,
        reason: reqItem.reason,
        refundAmount,
      };
    });

    const returnNumber = await generateReturnNumber(tx);
    const createdReturn = await tx.return.create({
      data: {
        returnNumber,
        invoiceId: invoice.id,
        totalRefund,
        createdById: actor.id,
        items: { create: itemsData },
      },
      include: { items: { include: { product: true } } },
    });

    for (const reqItem of data.items) {
      const invoiceItem = invoiceItemMap.get(reqItem.invoiceItemId)!;

      await tx.invoiceItem.update({
        where: { id: invoiceItem.id },
        data: { returnedQty: { increment: reqItem.qty } },
      });

      const stock = await tx.stock.findUnique({
        where: { productId_warehouseId: { productId: invoiceItem.productId, warehouseId: invoice.warehouseId } },
      });

      if (reqItem.reason === "normal") {
        const previousQty = stock?.quantity ?? 0;
        const newQty = previousQty + reqItem.qty;
        await tx.stock.upsert({
          where: { productId_warehouseId: { productId: invoiceItem.productId, warehouseId: invoice.warehouseId } },
          update: { quantity: newQty },
          create: {
            productId: invoiceItem.productId,
            warehouseId: invoice.warehouseId,
            quantity: newQty,
            reorderLevel: 0,
          },
        });
        await tx.stockLedger.create({
          data: {
            productId: invoiceItem.productId,
            warehouseId: invoice.warehouseId,
            changeQty: reqItem.qty,
            previousQty,
            balanceQty: newQty,
            referenceType: "return",
            referenceId: createdReturn.id,
            performedById: actor.id,
            reason: `Customer return (${reqItem.reason})`,
          },
        });
      } else {
        const newDamagedQty = (stock?.damagedQuantity ?? 0) + reqItem.qty;
        await tx.stock.upsert({
          where: { productId_warehouseId: { productId: invoiceItem.productId, warehouseId: invoice.warehouseId } },
          update: { damagedQuantity: newDamagedQty },
          create: {
            productId: invoiceItem.productId,
            warehouseId: invoice.warehouseId,
            damagedQuantity: newDamagedQty,
            reorderLevel: 0,
          },
        });
        // Defective stock is quarantined, not sellable — it's fully audited by the
        // Return/SupplierReturn tables themselves, so no StockLedger row here (that
        // ledger tracks sellable-quantity movements only).
      }
    }

    await recordAudit(tx, {
      userId: actor.id,
      action: "RETURN",
      entityType: "Return",
      entityId: createdReturn.id,
      metadata: {
        returnNumber: createdReturn.returnNumber,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        totalRefund: totalRefund.toString(),
      },
    });

    return createdReturn;
  });

  res.status(201).json(created);
});

export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      customer: true,
      warehouse: true,
      returns: { include: { items: true }, orderBy: { createdAt: "desc" } },
    },
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
      discount: Number(item.discount),
      taxAmount: Number(item.taxAmount),
      lineTotal: Number(item.lineTotal),
    })),
  });
});
