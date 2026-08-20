import { Router } from "express";
import { createCustomer, listCustomers } from "../controllers/customers.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, listCustomers);
router.post("/", authenticate, createCustomer);

export default router;
