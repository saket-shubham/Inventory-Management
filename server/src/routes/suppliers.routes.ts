import { Router } from "express";
import { createSupplier, listSuppliers } from "../controllers/suppliers.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, listSuppliers);
router.post("/", authenticate, createSupplier);

export default router;
