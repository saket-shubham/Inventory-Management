import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Billing } from "./pages/Billing";
import { InvoiceDetail } from "./pages/InvoiceDetail";
import { InvoiceHistory } from "./pages/InvoiceHistory";
import { AdminProducts } from "./pages/AdminProducts";
import { AdminStockAdjust } from "./pages/AdminStockAdjust";
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
      </Route>
    </Routes>
  );
}

export default App;
