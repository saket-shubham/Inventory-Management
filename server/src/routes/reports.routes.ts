import { Router } from "express";
import { getSalesSummary } from "../controllers/reports.controller";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/summary", authenticate, authorize("admin"), getSalesSummary);

export default router;
