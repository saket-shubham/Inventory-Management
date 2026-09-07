import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ScanLine,
  History,
  Package,
  Boxes,
  LayoutDashboard,
  Truck,
  LogOut,
  Sun,
  Moon,
  Users,
  ClipboardList,
  Tag,
  PauseCircle,
  Contact,
  Menu,
  X,
  Store,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useCart } from "../context/CartContext";

function getPageMeta(pathname: string) {
  if (pathname === "/") return { title: "Scan & Bill (POS)", Icon: ScanLine };
  if (pathname.startsWith("/invoices")) return { title: "Invoice History", Icon: History };
  if (pathname.startsWith("/hold")) return { title: "Hold Invoices", Icon: PauseCircle };
  if (pathname.startsWith("/customers")) return { title: "Customer Directory", Icon: Contact };
  if (pathname === "/admin/dashboard") return { title: "Executive Dashboard", Icon: LayoutDashboard };
  if (pathname.startsWith("/admin/products")) return { title: "Product Catalog", Icon: Package };
  if (pathname.startsWith("/admin/stock")) return { title: "Stock Adjustment", Icon: Boxes };
  if (pathname.startsWith("/admin/purchases")) return { title: "Purchases & Inbound", Icon: Truck };
  if (pathname.startsWith("/admin/staff")) return { title: "Staff Management", Icon: Users };
  if (pathname.startsWith("/admin/audit-logs")) return { title: "System Audit Logs", Icon: ClipboardList };
  if (pathname.startsWith("/admin/coupons")) return { title: "Discount Coupons", Icon: Tag };
  return { title: "Billing & Inventory", Icon: Store };
}

export function Layout() {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useTheme();
  const { lines } = useCart();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const pageMeta = getPageMeta(location.pathname);
  const PageIcon = pageMeta.Icon;

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  return (
    <div className="app-shell">
      {/* Mobile Backdrop */}
      <div
        className={`sidebar-backdrop${mobileOpen ? " active" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Modern Glass Sidebar */}
      <aside className={`app-sidebar${mobileOpen ? " open" : ""}`}>
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-mark">
            <ScanLine size={20} strokeWidth={2.4} />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-title">Apex POS</span>
            <span className="sidebar-brand-subtitle">Smart Inventory</span>
          </div>
          {mobileOpen && (
            <button
              type="button"
              className="action-icon-btn"
              style={{ marginLeft: "auto" }}
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Categorized Nav Links */}
        <nav className="sidebar-nav">
          {/* Section: POS & Sales */}
          <div className="nav-group">
            <h4 className="nav-group-title">POS &amp; Sales</h4>
            <NavLink to="/" end className="sidebar-link">
              <ScanLine size={16} />
              <span>Scan &amp; Bill</span>
              {lines.length > 0 ? (
                <span className="sidebar-badge" title={`${lines.length} items in cart`}>
                  {lines.length}
                </span>
              ) : (
                <span className="sidebar-badge" style={{ opacity: 0.6, fontSize: "9.5px" }}>
                  F2
                </span>
              )}
            </NavLink>
            <NavLink to="/hold" className="sidebar-link">
              <PauseCircle size={16} />
              <span>Hold Orders</span>
            </NavLink>
            <NavLink to="/invoices" className="sidebar-link">
              <History size={16} />
              <span>Invoices</span>
            </NavLink>
            <NavLink to="/customers" className="sidebar-link">
              <Contact size={16} />
              <span>Customers</span>
            </NavLink>
          </div>

          {/* Section: Operations */}
          <div className="nav-group">
            <h4 className="nav-group-title">Operations</h4>
            <NavLink to="/admin/dashboard" className="sidebar-link">
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/admin/products" className="sidebar-link">
              <Package size={16} />
              <span>Products</span>
            </NavLink>
            <NavLink to="/admin/stock" className="sidebar-link">
              <Boxes size={16} />
              <span>Stock &amp; Damage</span>
            </NavLink>
            <NavLink to="/admin/purchases" className="sidebar-link">
              <Truck size={16} />
              <span>Purchases</span>
            </NavLink>
          </div>

          {/* Section: Admin (if role === 'admin') */}
          {user?.role === "admin" && (
            <div className="nav-group">
              <h4 className="nav-group-title">Administration</h4>
              <NavLink to="/admin/staff" className="sidebar-link">
                <Users size={16} />
                <span>Staff Management</span>
              </NavLink>
              <NavLink to="/admin/coupons" className="sidebar-link">
                <Tag size={16} />
                <span>Coupons</span>
              </NavLink>
              <NavLink to="/admin/audit-logs" className="sidebar-link">
                <ClipboardList size={16} />
                <span>Audit Logs</span>
              </NavLink>
            </div>
          )}
        </nav>

        {/* Sidebar Footer with User Profile & Theme */}
        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="avatar">{initials}</div>
            <div className="sidebar-user-info">
              <p className="sidebar-user-name" title={user?.name}>
                {user?.name ?? "Logged In"}
              </p>
              <span className="role-badge">{user?.role ?? "staff"}</span>
            </div>
          </div>

          <div className="sidebar-footer-actions">
            <div className="theme-switcher">
              <button
                type="button"
                className="mode-switch-btn"
                onClick={toggleMode}
                title={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
                aria-label="Toggle theme"
              >
                {mode === "light" ? <Moon size={14} /> : <Sun size={14} />}
              </button>
              <span className="theme-switcher-label">{mode === "light" ? "Light" : "Dark"}</span>
            </div>

            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={logout}
              title="Sign out of system"
            >
              <LogOut size={14} />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="app-body">
        {/* Top Header */}
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="menu-toggle-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <h1 className="topbar-title">
              <PageIcon size={20} style={{ color: "var(--brand-600)" }} />
              <span>{pageMeta.title}</span>
            </h1>
          </div>

          <div className="topbar-right">
            <div className="counter-chip">
              <span className="counter-chip-dot" />
              <span>Active Session</span>
            </div>
            <div className="avatar" title={user?.name} style={{ width: 30, height: 30, fontSize: "11px" }}>
              {initials}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
