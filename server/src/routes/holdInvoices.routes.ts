import { Router } from "express";
import {
  createHoldInvoice,
  getHoldInvoice,
  listHoldInvoices,
  processHoldInvoice,
} from "../controllers/holdInvoices.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

// Billing-counter operation — open to admin and staff alike, same as the
// normal invoice/billing routes.
router.post("/", authenticate, createHoldInvoice);
router.get("/", authenticate, listHoldInvoices);
router.get("/:id", authenticate, getHoldInvoice);
router.post("/:id/process", authenticate, processHoldInvoice);

export default router;
