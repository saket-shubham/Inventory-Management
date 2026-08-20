import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">Billing App</div>
        <nav>
          <NavLink to="/" end>
            Scan &amp; Bill
          </NavLink>
          <NavLink to="/invoices">Invoice History</NavLink>
          {user?.role === "admin" && (
            <>
              <NavLink to="/admin/products">Products</NavLink>
              <NavLink to="/admin/stock">Stock</NavLink>
            </>
          )}
        </nav>
        <div className="user-info">
          <span>
            {user?.name} ({user?.role})
          </span>
          <button type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
