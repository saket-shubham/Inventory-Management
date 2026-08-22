import { Router } from "express";
import {
  cancelInvoice,
  createInvoice,
  createReturn,
  downloadInvoicePdf,
  getInvoice,
  listInvoices,
} from "../controllers/invoices.controller";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.post("/", authenticate, createInvoice);
router.get("/", authenticate, listInvoices);
router.get("/:id", authenticate, getInvoice);
router.get("/:id/pdf", authenticate, downloadInvoicePdf);
router.post("/:id/cancel", authenticate, authorize("admin"), cancelInvoice);
router.post("/:id/return", authenticate, authorize("admin"), createReturn);

export default router;
