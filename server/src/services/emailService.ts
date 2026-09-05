import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass) {
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
  return transporter;
}

export interface SendInvoiceEmailInput {
  to: string;
  customerName: string;
  invoiceNumber: string;
  grandTotal: string;
  pdfBuffer: Buffer;
}

export interface SendInvoiceEmailResult {
  sent: boolean;
  reason?: string;
}

/**
 * Emails the invoice PDF to a customer. Never throws — an unconfigured or
 * failing mail server must never break the billing flow that triggered it;
 * callers get back a plain sent/reason result to log or surface instead.
 */
export async function sendInvoiceEmail(input: SendInvoiceEmailInput): Promise<SendInvoiceEmailResult> {
  const t = getTransporter();
  if (!t) {
    return { sent: false, reason: "Email is not configured yet (set SMTP_HOST/SMTP_USER/SMTP_PASS in .env)" };
  }

  try {
    await t.sendMail({
      from: env.smtp.from || `"${env.companyName}" <${env.smtp.user}>`,
      to: input.to,
      subject: `Invoice ${input.invoiceNumber} — ${env.companyName}`,
      text: `Hi ${input.customerName},\n\nThank you for your purchase from ${env.companyName}.\nInvoice: ${input.invoiceNumber}\nTotal: Rs. ${input.grandTotal}\n\nYour invoice is attached as a PDF.`,
      attachments: [{ filename: `${input.invoiceNumber}.pdf`, content: input.pdfBuffer }],
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "Unknown email error" };
  }
}
