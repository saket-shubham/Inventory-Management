import PDFDocument from "pdfkit";
import type { Response } from "express";
import { env } from "../config/env";

interface InvoicePdfItem {
  product: { name: string; sku: string };
  qty: number;
  mrp: number;
  price: number;
  taxAmount: number;
  lineTotal: number;
}

interface InvoicePdfData {
  invoiceNumber: string;
  createdAt: Date;
  paymentMode: string;
  subtotal: number;
  taxAmount: number;
  discount: number;
  grandTotal: number;
  customer: { name: string; phone: string | null; gstNumber: string | null } | null;
  warehouse: { name: string; location: string | null };
  items: InvoicePdfItem[];
}

const money = (n: number) => n.toFixed(2);

export function streamInvoicePdf(res: Response, invoice: InvoicePdfData) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);

  doc.fontSize(18).text(env.companyName, { continued: false });
  doc.fontSize(9).fillColor("#555");
  if (env.companyAddress) doc.text(env.companyAddress);
  if (env.companyGstNumber) doc.text(`GSTIN: ${env.companyGstNumber}`);
  doc.fillColor("#000").moveDown(1);

  doc.fontSize(14).text(`Invoice ${invoice.invoiceNumber}`, { align: "right" });
  doc.fontSize(9).text(`Date: ${invoice.createdAt.toLocaleString()}`, { align: "right" });
  doc.text(`Payment mode: ${invoice.paymentMode.toUpperCase()}`, { align: "right" });
  doc.text(`Billed from: ${invoice.warehouse.name}${invoice.warehouse.location ? ` (${invoice.warehouse.location})` : ""}`, {
    align: "right",
  });
  doc.moveDown(1);

  if (invoice.customer) {
    doc.fontSize(10).text("Bill To:");
    doc.fontSize(9).text(invoice.customer.name);
    if (invoice.customer.phone) doc.text(invoice.customer.phone);
    if (invoice.customer.gstNumber) doc.text(`GSTIN: ${invoice.customer.gstNumber}`);
    doc.moveDown(1);
  }

  const tableTop = doc.y;
  const columns = [
    { label: "Product", width: 170 },
    { label: "Qty", width: 40 },
    { label: "MRP", width: 60 },
    { label: "Price", width: 60 },
    { label: "Tax", width: 60 },
    { label: "Total", width: 70 },
  ];

  let x = 40;
  doc.fontSize(9).fillColor("#000");
  for (const col of columns) {
    doc.text(col.label, x, tableTop, { width: col.width, align: col.label === "Product" ? "left" : "right" });
    x += col.width;
  }
  doc.moveTo(40, tableTop + 14).lineTo(500, tableTop + 14).strokeColor("#ccc").stroke();

  let y = tableTop + 20;
  for (const item of invoice.items) {
    x = 40;
    const row = [
      `${item.product.name} (${item.product.sku})`,
      String(item.qty),
      money(item.mrp),
      money(item.price),
      money(item.taxAmount),
      money(item.lineTotal),
    ];
    row.forEach((value, i) => {
      const col = columns[i];
      doc.text(value, x, y, { width: col.width, align: i === 0 ? "left" : "right" });
      x += col.width;
    });
    y += 18;
  }

  doc.moveTo(40, y + 4).lineTo(500, y + 4).strokeColor("#ccc").stroke();
  y += 14;

  const totals: Array<[string, number]> = [
    ["Subtotal", invoice.subtotal],
    ["Tax", invoice.taxAmount],
    ["Discount", -invoice.discount],
  ];
  for (const [label, value] of totals) {
    doc.text(label, 350, y, { width: 90, align: "right" });
    doc.text(money(value), 440, y, { width: 60, align: "right" });
    y += 16;
  }
  doc.fontSize(11).text("Grand Total", 350, y, { width: 90, align: "right" });
  doc.text(money(invoice.grandTotal), 440, y, { width: 60, align: "right" });

  doc.end();
}
