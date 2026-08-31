import { Router } from "express";
import {
  createSupplierReturn,
  getSupplierReturn,
  listSupplierReturns,
} from "../controllers/supplierReturns.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/", authenticate, createSupplierReturn);
router.get("/", authenticate, listSupplierReturns);
router.get("/:id", authenticate, getSupplierReturn);

export default router;
