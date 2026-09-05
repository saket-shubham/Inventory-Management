import { Router } from "express";
import { createCoupon, listCoupons, updateCoupon, validateCoupon } from "../controllers/coupons.controller";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// Any authenticated user (admin or staff) can look up/apply a coupon while billing.
router.get("/", authenticate, listCoupons);
router.get("/validate", authenticate, validateCoupon);

// Defining/managing coupons is admin-only — "configurable/managed by me".
router.post("/", authenticate, authorize("admin"), createCoupon);
router.put("/:id", authenticate, authorize("admin"), updateCoupon);

export default router;
