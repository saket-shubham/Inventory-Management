import { Router } from "express";
import { adjustStock, listLowStock } from "../controllers/stock.controller";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/low", authenticate, listLowStock);
router.post("/adjust", authenticate, authorize("admin"), adjustStock);

export default router;
