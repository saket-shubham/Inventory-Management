import { Router } from "express";
import { adjustStock, listDamagedStock, listLowStock, markDamaged } from "../controllers/stock.controller";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/low", authenticate, listLowStock);
router.get("/damaged", authenticate, listDamagedStock);
router.post("/adjust", authenticate, authorize("admin"), adjustStock);
router.post("/mark-damaged", authenticate, authorize("admin"), markDamaged);

export default router;
