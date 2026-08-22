import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarDays, LayoutDashboard, PackageX, Receipt, TrendingUp } from "lucide-react";
import { api } from "../api/client";
import type { DamagedStockRow, LowStockRow, SalesSummary } from "../types";

export function Dashboard() {
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [lowStock, setLowStock] = useState<LowStockRow[]>([]);
  const [damagedStock, setDamagedStock] = useState<DamagedStockRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<SalesSummary>("/reports/summary"),
      api.get<LowStockRow[]>("/stock/low"),
      api.get<DamagedStockRow[]>("/stock/damaged"),
    ])
      .then(([summaryRes, lowStockRes, damagedRes]) => {
        setSummary(summaryRes.data);
        setLowStock(lowStockRes.data);
        setDamagedStock(damagedRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">Loading dashboard...</div>;
  if (!summary) return null;

  return (
    <div className="dashboard-page">
      <h2>
        <LayoutDashboard size={19} /> Dashboard
      </h2>

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-icon">
            <CalendarDays size={18} />
          </span>
          <div>
            <span className="stat-label">Today's Sales</span>
            <span className="stat-value">₹{Number(summary.today.totalSales).toFixed(2)}</span>
            <span className="stat-sub">{summary.today.invoiceCount} invoice(s)</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <TrendingUp size={18} />
          </span>
          <div>
            <span className="stat-label">This Month's Sales</span>
            <span className="stat-value">₹{Number(summary.thisMonth.totalSales).toFixed(2)}</span>
            <span className="stat-sub">{summary.thisMonth.invoiceCount} invoice(s)</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <Receipt size={18} />
          </span>
          <div>
            <span className="stat-label">Low Stock Items</span>
            <span className="stat-value">{lowStock.length}</span>
            <span className="stat-sub">across all warehouses</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">
            <PackageX size={18} />
          </span>
          <div>
            <span className="stat-label">Damaged Stock</span>
            <span className="stat-value">{damagedStock.reduce((sum, d) => sum + d.damagedQuantity, 0)}</span>
            <span className="stat-sub">units quarantined</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-panel">
          <h3>Top Selling Products (this month)</h3>
          <table className="cart-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty sold</th>
              </tr>
            </thead>
            <tbody>
              {summary.topProducts.length === 0 && (
                <tr>
                  <td colSpan={2} className="muted">
                    No sales yet this month.
                  </td>
                </tr>
              )}
              {summary.topProducts.map((p) => (
                <tr key={p.productId}>
                  <td>
                    {p.productName} <span className="muted small">({p.sku})</span>
                  </td>
                  <td>{p.qtySold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="dashboard-panel">
          <h3>Sales by Warehouse (this month)</h3>
          <table className="cart-table">
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>Total sales</th>
              </tr>
            </thead>
            <tbody>
              {summary.salesByWarehouse.length === 0 && (
                <tr>
                  <td colSpan={2} className="muted">
                    No sales yet this month.
                  </td>
                </tr>
              )}
              {summary.salesByWarehouse.map((w) => (
                <tr key={w.warehouseId}>
                  <td>{w.warehouseName}</td>
                  <td>₹{Number(w.totalSales).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dashboard-panel">
        <h3>
          <AlertTriangle size={16} /> Low Stock
        </h3>
        <table className="cart-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Warehouse</th>
              <th>Qty</th>
              <th>Reorder level</th>
            </tr>
          </thead>
          <tbody>
            {lowStock.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Nothing is low on stock right now.
                </td>
              </tr>
            )}
            {lowStock.map((row) => (
              <tr key={`${row.productId}-${row.warehouseId}`} className={row.quantity === 0 ? "current-warehouse" : ""}>
                <td>
                  {row.productName} <span className="muted small">({row.sku})</span>
                </td>
                <td>{row.warehouseName}</td>
                <td>
                  {row.quantity}
                  {row.quantity === 0 ? (
                    <span className="out-of-stock-badge">out</span>
                  ) : (
                    <span className="low-stock-badge">low</span>
                  )}
                </td>
                <td>{row.reorderLevel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dashboard-panel" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ marginBottom: 0 }}>
            <PackageX size={16} /> Damaged Stock
          </h3>
          <Link to="/admin/stock" className="inline-link small">
            Mark stock as damaged →
          </Link>
        </div>
        <p className="muted small" style={{ margin: "6px 0 10px" }}>
          Defective units that have been pulled out of sellable stock — from customer returns marked "defective," or
          marked directly on the Stock page. Send them back to a supplier from Purchases → Return to Supplier.
        </p>
        <table className="cart-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Warehouse</th>
              <th>Damaged qty</th>
            </tr>
          </thead>
          <tbody>
            {damagedStock.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  No damaged/quarantined stock right now.
                </td>
              </tr>
            )}
            {damagedStock.map((row) => (
              <tr key={`${row.productId}-${row.warehouseId}`}>
                <td>
                  {row.productName} <span className="muted small">({row.sku})</span>
                </td>
                <td>{row.warehouseName}</td>
                <td>
                  {row.damagedQuantity}
                  <span className="out-of-stock-badge">damaged</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
