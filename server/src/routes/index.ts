import { Router } from "express";
import authRoutes from "./auth.routes";
import productRoutes from "./products.routes";
import warehouseRoutes from "./warehouses.routes";
import customerRoutes from "./customers.routes";
import stockRoutes from "./stock.routes";
import invoiceRoutes from "./invoices.routes";
import reportRoutes from "./reports.routes";
import supplierRoutes from "./suppliers.routes";
import purchaseRoutes from "./purchases.routes";
import supplierReturnRoutes from "./supplierReturns.routes";
import userRoutes from "./users.routes";
import auditLogRoutes from "./auditLogs.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/products", productRoutes);
router.use("/warehouses", warehouseRoutes);
router.use("/customers", customerRoutes);
router.use("/stock", stockRoutes);
router.use("/invoices", invoiceRoutes);
router.use("/reports", reportRoutes);
router.use("/suppliers", supplierRoutes);
router.use("/purchases", purchaseRoutes);
router.use("/supplier-returns", supplierReturnRoutes);
router.use("/users", userRoutes);
router.use("/audit-logs", auditLogRoutes);

export default router;
