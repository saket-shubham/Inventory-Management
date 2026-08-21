import { Router } from "express";
import {
  createProduct,
  getProductStock,
  listProducts,
  lookupByBarcode,
  updateProduct,
} from "../controllers/products.controller";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/lookup", authenticate, lookupByBarcode);
router.get("/:id/stock", authenticate, getProductStock);
router.get("/", authenticate, listProducts);
router.post("/", authenticate, authorize("admin"), createProduct);
router.put("/:id", authenticate, authorize("admin"), updateProduct);

export default router;
