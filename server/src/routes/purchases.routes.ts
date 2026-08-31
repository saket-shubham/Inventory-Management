import { Router } from "express";
import { createPurchase, getPurchase, listPurchases } from "../controllers/purchases.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/", authenticate, createPurchase);
router.get("/", authenticate, listPurchases);
router.get("/:id", authenticate, getPurchase);

export default router;
