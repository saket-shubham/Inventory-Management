import { Router } from "express";
import {
  createSupplierReturn,
  getSupplierReturn,
  listSupplierReturns,
} from "../controllers/supplierReturns.controller";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.post("/", authenticate, authorize("admin"), createSupplierReturn);
router.get("/", authenticate, authorize("admin"), listSupplierReturns);
router.get("/:id", authenticate, authorize("admin"), getSupplierReturn);

export default router;
