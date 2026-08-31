import { Router } from "express";
import { getSalesSummary } from "../controllers/reports.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/summary", authenticate, getSalesSummary);

export default router;
