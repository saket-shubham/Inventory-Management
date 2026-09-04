import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Billing } from "./pages/Billing";
import { InvoiceDetail } from "./pages/InvoiceDetail";
import { InvoiceHistory } from "./pages/InvoiceHistory";
import { AdminProducts } from "./pages/AdminProducts";
import { AdminStockAdjust } from "./pages/AdminStockAdjust";
import { AdminPurchases } from "./pages/AdminPurchases";
import { AdminStaff } from "./pages/AdminStaff";
import { AdminStaffDetail } from "./pages/AdminStaffDetail";
import { AdminAuditLogs } from "./pages/AdminAuditLogs";
import { AdminCoupons } from "./pages/AdminCoupons";
import { HoldInvoices } from "./pages/HoldInvoices";
import { HoldInvoiceDetail } from "./pages/HoldInvoiceDetail";
import { Customers } from "./pages/Customers";
import { Dashboard } from "./pages/Dashboard";
import { CartProvider } from "./context/CartContext";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <CartProvider>
              <Layout />
            </CartProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Billing />} />
        <Route path="/invoices" element={<InvoiceHistory />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/hold" element={<HoldInvoices />} />
        <Route path="/hold/:id" element={<HoldInvoiceDetail />} />
        <Route path="/customers" element={<Customers />} />
        {/* Open to any logged-in user (admin or staff) — only Staff Management
            and Audit Logs below stay admin-only. */}
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="/admin/products" element={<AdminProducts />} />
        <Route path="/admin/stock" element={<AdminStockAdjust />} />
        <Route path="/admin/purchases" element={<AdminPurchases />} />
        <Route
          path="/admin/staff"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminStaff />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/staff/:id"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminStaffDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminAuditLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/coupons"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminCoupons />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
