import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Filter, History, ReceiptText } from "lucide-react";
import { api } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import type { Invoice } from "../types";

export function InvoiceHistory() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filters, setFilters] = useState({ from: "", to: "", customer: "", product: "", invoiceNumber: "" });
  const [loading, setLoading] = useState(false);

  async function loadInvoices() {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v.trim() !== ""));
      const res = await api.get<Invoice[]>("/invoices", { params });
      setInvoices(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="invoice-history">
      <h2>
        <History size={19} /> Invoice History
      </h2>

      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          loadInvoices();
        }}
      >
        <label>
          From
          <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </label>
        <label>
          To
          <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </label>
        <label>
          Customer
          <input value={filters.customer} onChange={(e) => setFilters({ ...filters, customer: e.target.value })} />
        </label>
        <label>
          Product
          <input value={filters.product} onChange={(e) => setFilters({ ...filters, product: e.target.value })} />
        </label>
        <label>
          Invoice #
          <input
            value={filters.invoiceNumber}
            onChange={(e) => setFilters({ ...filters, invoiceNumber: e.target.value })}
          />
        </label>
        <button type="submit">
          <Filter size={14} /> Filter
        </button>
      </form>

      {loading ? (
        <div className="page-loading">Loading invoices...</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="cart-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Warehouse</th>
                <th>Customer</th>
                <th className="num text-center">Items</th>
                <th className="num text-right">Grand Total</th>
                <th className="text-center">Payment</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <Link to={`/invoices/${inv.id}`} className="invoice-number-link">
                      <ReceiptText size={14} /> {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="muted small">{new Date(inv.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{inv.warehouse.name}</span>
                  </td>
                  <td>{inv.customer?.name ?? <span className="muted">Walk-in</span>}</td>
                  <td className="num text-center">
                    <span className="sidebar-badge" style={{ fontSize: "11px" }}>
                      {inv.items.length}
                    </span>
                  </td>
                  <td className="num text-right" style={{ fontWeight: 700, color: "var(--brand-700)" }}>
                    ₹{Number(inv.grandTotal).toFixed(2)}
                  </td>
                  <td className="text-center">
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "11px",
                        fontWeight: 700,
                        background: "var(--chip-bg)",
                        border: "1px solid var(--border-soft)",
                      }}
                    >
                      {inv.paymentMode.toUpperCase()}
                    </span>
                  </td>
                  <td className="text-center">
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted" style={{ textAlign: "center", padding: "36px 16px" }}>
                    No invoices match your search filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
