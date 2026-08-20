import { Router } from "express";
import { adjustStock } from "../controllers/stock.controller";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.post("/adjust", authenticate, authorize("admin"), adjustStock);

export default router;
