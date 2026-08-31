import { Router } from "express";
import { listAuditLogs } from "../controllers/auditLogs.controller";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, authorize("admin"), listAuditLogs);

export default router;
