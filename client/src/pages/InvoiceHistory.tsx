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
        <p className="muted">Loading...</p>
      ) : (
        <table className="cart-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Warehouse</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Grand Total</th>
              <th>Payment</th>
              <th>Status</th>
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
                <td>{new Date(inv.createdAt).toLocaleDateString()}</td>
                <td>{inv.warehouse.name}</td>
                <td>{inv.customer?.name ?? "Walk-in"}</td>
                <td>{inv.items.length}</td>
                <td>₹{Number(inv.grandTotal).toFixed(2)}</td>
                <td>{inv.paymentMode.toUpperCase()}</td>
                <td>
                  <StatusBadge status={inv.status} />
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
