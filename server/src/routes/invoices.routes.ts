import { Router } from "express";
import {
  cancelInvoice,
  createInvoice,
  createReturn,
  deleteInvoice,
  downloadInvoicePdf,
  getInvoice,
  listInvoices,
  sendInvoiceEmailNow,
} from "../controllers/invoices.controller";
import { authenticate, authorize } from "../middleware/auth";
import { invoiceWriteRateLimit } from "../middleware/rateLimit";

const router = Router();

router.post("/", authenticate, invoiceWriteRateLimit, createInvoice);
router.get("/", authenticate, listInvoices);
router.get("/:id", authenticate, getInvoice);
router.get("/:id/pdf", authenticate, downloadInvoicePdf);
router.post("/:id/cancel", authenticate, invoiceWriteRateLimit, cancelInvoice);
router.delete("/:id", authenticate, authorize("admin"), invoiceWriteRateLimit, deleteInvoice);
router.post("/:id/return", authenticate, invoiceWriteRateLimit, createReturn);
router.post("/:id/send-email", authenticate, invoiceWriteRateLimit, sendInvoiceEmailNow);

export default router;
