import { Router } from "express";
import {
  cancelInvoice,
  createInvoice,
  createReturn,
  downloadInvoicePdf,
  getInvoice,
  listInvoices,
  sendInvoiceEmailNow,
} from "../controllers/invoices.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/", authenticate, createInvoice);
router.get("/", authenticate, listInvoices);
router.get("/:id", authenticate, getInvoice);
router.get("/:id/pdf", authenticate, downloadInvoicePdf);
router.post("/:id/cancel", authenticate, cancelInvoice);
router.post("/:id/return", authenticate, createReturn);
router.post("/:id/send-email", authenticate, sendInvoiceEmailNow);

export default router;
