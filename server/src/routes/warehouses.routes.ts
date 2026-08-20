import { Router } from "express";
import { listWarehouses } from "../controllers/warehouses.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, listWarehouses);

export default router;
