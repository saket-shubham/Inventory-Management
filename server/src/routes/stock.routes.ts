import { Router } from "express";
import { adjustStock, listDamagedStock, listLowStock, markDamaged, transferStock } from "../controllers/stock.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/low", authenticate, listLowStock);
router.get("/damaged", authenticate, listDamagedStock);
router.post("/adjust", authenticate, adjustStock);
router.post("/transfer", authenticate, transferStock);
router.post("/mark-damaged", authenticate, markDamaged);

export default router;
