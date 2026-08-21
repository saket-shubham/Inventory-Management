import { NavLink, Outlet } from "react-router-dom";
import { ScanLine, History, Package, Boxes, LayoutDashboard, Truck, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const { user, logout } = useAuth();
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">
            <ScanLine size={18} strokeWidth={2.4} />
          </span>
          Billing App
        </div>
        <nav>
          <NavLink to="/" end>
            <ScanLine size={15} /> Scan &amp; Bill
          </NavLink>
          <NavLink to="/invoices">
            <History size={15} /> Invoice History
          </NavLink>
          {user?.role === "admin" && (
            <>
              <NavLink to="/admin/dashboard">
                <LayoutDashboard size={15} /> Dashboard
              </NavLink>
              <NavLink to="/admin/products">
                <Package size={15} /> Products
              </NavLink>
              <NavLink to="/admin/stock">
                <Boxes size={15} /> Stock
              </NavLink>
              <NavLink to="/admin/purchases">
                <Truck size={15} /> Purchases
              </NavLink>
            </>
          )}
        </nav>
        <div className="user-info">
          <span className="user-chip">
            <span className="avatar">{initials}</span>
            {user?.name}
            <span className="role-badge">{user?.role}</span>
          </span>
          <button type="button" className="link-button" onClick={logout}>
            <LogOut size={14} /> Log out
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
