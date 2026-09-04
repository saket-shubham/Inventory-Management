import { Router } from "express";
import { createCustomer, getCustomer, listCustomers } from "../controllers/customers.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, listCustomers);
router.get("/:id", authenticate, getCustomer);
router.post("/", authenticate, createCustomer);

export default router;
