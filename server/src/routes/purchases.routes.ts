import { Router } from "express";
import { createPurchase, getPurchase, listPurchases } from "../controllers/purchases.controller";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.post("/", authenticate, authorize("admin"), createPurchase);
router.get("/", authenticate, authorize("admin"), listPurchases);
router.get("/:id", authenticate, authorize("admin"), getPurchase);

export default router;
