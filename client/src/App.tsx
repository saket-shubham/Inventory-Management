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
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/products"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminProducts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/stock"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminStockAdjust />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/purchases"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminPurchases />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
