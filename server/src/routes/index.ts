import { Router } from "express";
import authRoutes from "./auth.routes";
import productRoutes from "./products.routes";
import warehouseRoutes from "./warehouses.routes";
import customerRoutes from "./customers.routes";
import stockRoutes from "./stock.routes";
import invoiceRoutes from "./invoices.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/products", productRoutes);
router.use("/warehouses", warehouseRoutes);
router.use("/customers", customerRoutes);
router.use("/stock", stockRoutes);
router.use("/invoices", invoiceRoutes);

export default router;
