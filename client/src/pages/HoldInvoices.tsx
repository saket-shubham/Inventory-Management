import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Filter, PauseCircle } from "lucide-react";
import { api } from "../api/client";
import { HoldStatusBadge } from "../components/HoldStatusBadge";
import type { HoldInvoice, HoldStatus } from "../types";

export function HoldInvoices() {
  const [holds, setHolds] = useState<HoldInvoice[]>([]);
  const [status, setStatus] = useState<HoldStatus | "">("");
  const [loading, setLoading] = useState(false);

  async function loadHolds() {
    setLoading(true);
    try {
      const res = await api.get<HoldInvoice[]>("/hold-invoices", { params: status ? { status } : {} });
      setHolds(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHolds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="invoice-history">
      <h2>
        <PauseCircle size={19} /> Hold
      </h2>

      <form className="filters" onSubmit={(e) => e.preventDefault()}>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as HoldStatus | "")}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="returned">Returned</option>
            <option value="expired">Expired</option>
          </select>
        </label>
        <button type="button" onClick={loadHolds}>
          <Filter size={14} /> Refresh
        </button>
      </form>

      {loading ? (
        <p className="muted">Loading...</p>
      ) : (
        <table className="cart-table">
          <thead>
            <tr>
              <th>Hold #</th>
              <th>Date</th>
              <th>Warehouse</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Expires</th>
              <th>Status</th>
              <th>Final invoice</th>
            </tr>
          </thead>
          <tbody>
            {holds.map((h) => (
              <tr key={h.id}>
                <td>
                  <Link to={`/hold/${h.id}`} className="invoice-number-link">
                    {h.holdNumber}
                  </Link>
                </td>
                <td>{new Date(h.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td>{h.warehouse.name}</td>
                <td>{h.customer?.name ?? "Walk-in"}</td>
                <td>{h.items.length}</td>
                <td>{new Date(h.expiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td>
                  <HoldStatusBadge status={h.status} />
                </td>
                <td>
                  {h.finalInvoice ? (
                    <Link to={`/invoices/${h.finalInvoice.id}`} className="invoice-number-link">
                      {h.finalInvoice.invoiceNumber}
                    </Link>
                  ) : (
                    <span className="muted small">—</span>
                  )}
                </td>
              </tr>
            ))}
            {holds.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  No hold invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
