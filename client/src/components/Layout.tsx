import { NavLink, Outlet } from "react-router-dom";
import { ScanLine, History, Package, Boxes, LayoutDashboard, Truck, LogOut, Sun, Moon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme, type ThemeAccent } from "../context/ThemeContext";

const ACCENTS: { value: ThemeAccent; label: string; swatch: string }[] = [
  { value: "violet", label: "Violet", swatch: "#6366f1" },
  { value: "blue", label: "Blue", swatch: "#0ea5e9" },
  { value: "green", label: "Green", swatch: "#10b981" },
];

function ThemeSwitcher() {
  const { mode, accent, toggleMode, setAccent } = useTheme();
  return (
    <div className="theme-switcher">
      <div className="accent-swatches">
        {ACCENTS.map((a) => (
          <button
            key={a.value}
            type="button"
            className={`accent-swatch${accent === a.value ? " active" : ""}`}
            style={{ background: a.swatch }}
            title={a.label}
            aria-label={`${a.label} accent`}
            onClick={() => setAccent(a.value)}
          />
        ))}
      </div>
      <button
        type="button"
        className="mode-switch-btn"
        onClick={toggleMode}
        title={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}
        aria-label="Toggle color mode"
      >
        {mode === "light" ? <Moon size={16} /> : <Sun size={16} />}
      </button>
    </div>
  );
}

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
          <ThemeSwitcher />
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
