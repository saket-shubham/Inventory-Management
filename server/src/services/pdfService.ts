import PDFDocument from "pdfkit";
import type { Response } from "express";
import { env } from "../config/env";

interface InvoicePdfItem {
  product: { name: string; sku: string };
  qty: number;
  mrp: string;
  price: string;
  discount: string;
  taxAmount: string;
  lineTotal: string;
}

interface InvoicePdfData {
  invoiceNumber: string;
  createdAt: Date;
  paymentMode: string;
  // Drives the CANCELLED marking below — anything other than "paid" is shown
  // as void, since a cancelled invoice's PDF must never look like a valid one.
  status: string;
  // Already formatted to 2dp directly from the Decimal that's actually saved
  // in the database — never round-tripped through a plain JS Number, so the
  // printed figure can't silently disagree with the stored amount.
  subtotal: string;
  taxAmount: string;
  couponCode?: string | null;
  couponDiscountPercent?: string | null;
  couponDiscountAmount?: string | null;
  packagingCharge?: string;
  transportCharge?: string;
  grandTotal: string;
  customer: { name: string; phone: string | null; gstNumber: string | null } | null;
  warehouse: { name: string; location: string | null };
  items: InvoicePdfItem[];
}

function renderInvoicePdf(doc: PDFKit.PDFDocument, invoice: InvoicePdfData) {
  // A cancelled invoice's PDF must never be able to pass as a valid one —
  // stamped first, underneath everything else, diagonally across the page.
  if (invoice.status !== "paid") {
    doc.save();
    doc.fillColor("#e11d48").opacity(0.28);
    doc.fontSize(72);
    doc.rotate(-35, { origin: [300, 400] });
    doc.text(invoice.status.toUpperCase(), 40, 380, { width: 520, align: "center" });
    doc.restore();
  }

  doc.fontSize(18).text(env.companyName, { continued: false });
  doc.fontSize(9).fillColor("#555");
  if (env.companyAddress) doc.text(env.companyAddress);
  if (env.companyGstNumber) doc.text(`GSTIN: ${env.companyGstNumber}`);
  doc.fillColor("#000").moveDown(1);

  doc.fontSize(14).text(`Invoice ${invoice.invoiceNumber}`, { align: "right" });
  if (invoice.status !== "paid") {
    doc.fontSize(11).fillColor("#e11d48").text(`STATUS: ${invoice.status.toUpperCase()}`, { align: "right" });
    doc.fillColor("#000");
  }
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
    { label: "Product", width: 150 },
    { label: "Qty", width: 35 },
    { label: "MRP", width: 55 },
    { label: "Price", width: 55 },
    { label: "Disc.", width: 50 },
    { label: "Tax", width: 55 },
    { label: "Total", width: 60 },
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
      item.mrp,
      item.price,
      item.discount,
      item.taxAmount,
      item.lineTotal,
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

  // Every value here is already a Decimal-precise, 2dp-formatted string —
  // built straight from the database, never re-parsed as a JS number.
  const totals: Array<[string, string]> = [
    ["Subtotal", invoice.subtotal],
    ["Tax", invoice.taxAmount],
  ];
  // Coupon row only appears when a coupon was actually applied to this invoice.
  if (invoice.couponCode && invoice.couponDiscountAmount && Number(invoice.couponDiscountAmount) > 0) {
    totals.push([`Coupon (${invoice.couponCode}, ${invoice.couponDiscountPercent}%)`, `-${invoice.couponDiscountAmount}`]);
  }
  // Packaging/Transport rows only appear when actually entered on this invoice.
  if (invoice.packagingCharge && Number(invoice.packagingCharge) > 0) {
    totals.push(["Packaging Charges", invoice.packagingCharge]);
  }
  if (invoice.transportCharge && Number(invoice.transportCharge) > 0) {
    totals.push(["Transport Charges", invoice.transportCharge]);
  }
  for (const [label, value] of totals) {
    doc.text(label, 350, y, { width: 90, align: "right" });
    doc.text(value, 440, y, { width: 60, align: "right" });
    y += 16;
  }
  doc.fontSize(11).text("Grand Total", 350, y, { width: 90, align: "right" });
  doc.text(invoice.grandTotal, 440, y, { width: 60, align: "right" });
}

export function streamInvoicePdf(res: Response, invoice: InvoicePdfData) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);
  renderInvoicePdf(doc, invoice);
  doc.end();
}

/** Same PDF, built in-memory — used for emailing the invoice as an attachment. */
export function buildInvoicePdfBuffer(invoice: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    renderInvoicePdf(doc, invoice);
    doc.end();
  });
}
