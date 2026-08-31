import { useEffect, useRef, useState } from "react";
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
  ChevronDown,
  Palette,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function ThemeSwitcher() {
  const { mode, toggleMode } = useTheme();
  return (
    <div className="theme-switcher">
      <button
        type="button"
        className="mode-switch-btn"
        onClick={toggleMode}
        title={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
        aria-label="Toggle color mode"
      >
        {mode === "light" ? <Moon size={16} /> : <Sun size={16} />}
      </button>
      <span className="theme-switcher-label">{mode === "light" ? "Light mode" : "Dark mode"}</span>
    </div>
  );
}

function BrandMenu() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [themesOpen, setThemesOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setOpen(false);
    setThemesOpen(false);
  }, [location.pathname]);

  return (
    <div className="admin-menu" ref={menuRef}>
      <button type="button" className="brand admin-menu-trigger" onClick={() => setOpen((o) => !o)}>
        <span className="brand-mark">
          <ScanLine size={18} strokeWidth={2.4} />
        </span>
        Billing App
        <ChevronDown size={14} className={`admin-menu-chevron${open ? " open" : ""}`} />
      </button>
      {open && (
        <div className="admin-menu-panel">
          <div className="admin-menu-user">
            <span className="avatar">{initials}</span>
            <div>
              <p className="admin-menu-user-name">{user?.name}</p>
              <span className="role-badge">{user?.role}</span>
            </div>
          </div>
          <div className="user-menu-divider" />

          {user?.role === "admin" && (
            <>
              <NavLink to="/admin/staff" className="admin-menu-item">
                <Users size={15} /> Staff Management
              </NavLink>
              <NavLink to="/admin/audit-logs" className="admin-menu-item">
                <ClipboardList size={15} /> Audit Logs
              </NavLink>
            </>
          )}

          <button type="button" className="admin-menu-item" onClick={() => setThemesOpen((o) => !o)}>
            <Palette size={15} /> Themes
            <ChevronDown size={13} className={`admin-menu-chevron themes-chevron${themesOpen ? " open" : ""}`} />
          </button>
          {themesOpen && (
            <div className="themes-submenu">
              <ThemeSwitcher />
            </div>
          )}

          <div className="user-menu-divider" />
          <button type="button" className="admin-menu-item danger-link" onClick={logout}>
            <LogOut size={15} /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <BrandMenu />
        <nav>
          <NavLink to="/" end>
            <ScanLine size={15} /> Scan &amp; Bill
          </NavLink>
          <NavLink to="/invoices">
            <History size={15} /> Invoice History
          </NavLink>
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
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
