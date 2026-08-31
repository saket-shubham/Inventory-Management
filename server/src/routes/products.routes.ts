import { Router } from "express";
import {
  createProduct,
  createProductsBulk,
  getProductStock,
  listProducts,
  lookupByBarcode,
  updateProduct,
} from "../controllers/products.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

// Open to any authenticated user (admin or staff) — only Staff Management and
// Audit Logs stay admin-only in this app.
router.get("/lookup", authenticate, lookupByBarcode);
router.get("/:id/stock", authenticate, getProductStock);
router.get("/", authenticate, listProducts);
router.post("/", authenticate, createProduct);
router.post("/bulk", authenticate, createProductsBulk);
router.put("/:id", authenticate, updateProduct);

export default router;
