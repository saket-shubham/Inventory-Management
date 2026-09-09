import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, PauseCircle, TriangleAlert } from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import { HoldStatusBadge } from "../components/HoldStatusBadge";
import type { HoldInvoice } from "../types";

interface DecisionRow {
  keep: string;
  returnNormal: string;
  returnDamaged: string;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function HoldInvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [hold, setHold] = useState<HoldInvoice | null>(null);
  const [decisions, setDecisions] = useState<Record<number, DecisionRow>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadHold() {
    api.get<HoldInvoice>(`/hold-invoices/${id}`).then((res) => {
      setHold(res.data);
      if (res.data.status === "active") {
        const initial: Record<number, DecisionRow> = {};
        for (const item of res.data.items) {
          initial[item.id] = { keep: String(item.qty), returnNormal: "0", returnDamaged: "0" };
        }
        setDecisions(initial);
      }
    });
  }

  useEffect(() => {
    loadHold();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!hold) return <div className="page-loading">Loading hold invoice...</div>;

  function updateDecision(itemId: number, field: keyof DecisionRow, value: string) {
    setDecisions((prev) => {
      const current = prev[itemId] ?? { keep: "0", returnNormal: "0", returnDamaged: "0" };
      const updated: DecisionRow = { ...current, [field]: value };

      // Returning a unit should free you from also having to go edit Keep —
      // it drops automatically so the row balances itself.
      if (field === "returnNormal" || field === "returnDamaged") {
        const item = hold?.items.find((i) => i.id === itemId);
        if (item) {
          const returnNormal = Number(updated.returnNormal) || 0;
          const returnDamaged = Number(updated.returnDamaged) || 0;
          updated.keep = String(Math.max(0, item.qty - returnNormal - returnDamaged));
        }
      }

      return { ...prev, [itemId]: updated };
    });
  }

  function accountedFor(itemId: number): number {
    const d = decisions[itemId];
    if (!d) return 0;
    return (Number(d.keep) || 0) + (Number(d.returnNormal) || 0) + (Number(d.returnDamaged) || 0);
  }

  const allBalanced = hold.items.every((item) => accountedFor(item.id) === item.qty);

  async function handleProcess() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<HoldInvoice>(`/hold-invoices/${hold!.id}/process`, {
        items: hold!.items.map((item) => ({
          holdInvoiceItemId: item.id,
          keepQty: Number(decisions[item.id]?.keep) || 0,
          returnNormalQty: Number(decisions[item.id]?.returnNormal) || 0,
          returnDamagedQty: Number(decisions[item.id]?.returnDamaged) || 0,
        })),
      });
      setHold(res.data);
      if (res.data.finalInvoice) {
        navigate(`/invoices/${res.data.finalInvoice.id}`);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const isActive = hold.status === "active";

  return (
    <div className="invoice-detail">
      <Link to="/hold" className="inline-link small">
        <ArrowLeft size={13} /> Back to Hold
      </Link>

      <div className="invoice-detail-header">
        <div>
          <h2>
            <PauseCircle size={19} /> {hold.holdNumber} <HoldStatusBadge status={hold.status} />
          </h2>
          <p className="muted">
            {formatDateTime(hold.createdAt)} · {hold.warehouse.name}
            {hold.customer ? ` · ${hold.customer.name}` : " · Walk-in"}
          </p>
          <p className="muted small">
            {isActive ? "Expires" : "Expired/processed by"}: {formatDateTime(hold.expiresAt)}
          </p>
        </div>
        {hold.finalInvoice && (
          <Link to={`/invoices/${hold.finalInvoice.id}`} className="button-link">
            View final invoice ({hold.finalInvoice.invoiceNumber})
          </Link>
        )}
      </div>

      <table className="cart-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Held qty</th>
            <th>Price</th>
            {isActive ? (
              <>
                <th>Keep</th>
                <th>Return (normal)</th>
                <th>Return (damaged)</th>
                <th>Balance</th>
              </>
            ) : (
              <>
                <th>Kept</th>
                <th>Returned (normal)</th>
                <th>Returned (damaged)</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {hold.items.map((item) => {
            const remaining = item.qty - accountedFor(item.id);
            return (
              <tr key={item.id}>
                <td>
                  {item.product.name} <span className="muted small">({item.product.sku})</span>
                </td>
                <td>{item.qty}</td>
                <td>₹{Number(item.price).toFixed(2)}</td>
                {isActive ? (
                  <>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={item.qty}
                        className="qty-input"
                        value={decisions[item.id]?.keep ?? "0"}
                        onChange={(e) => updateDecision(item.id, "keep", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={item.qty}
                        className="qty-input"
                        value={decisions[item.id]?.returnNormal ?? "0"}
                        onChange={(e) => updateDecision(item.id, "returnNormal", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={item.qty}
                        className="qty-input"
                        value={decisions[item.id]?.returnDamaged ?? "0"}
                        onChange={(e) => updateDecision(item.id, "returnDamaged", e.target.value)}
                      />
                    </td>
                    <td>
                      {remaining === 0 ? (
                        <span className="discount-badge">balanced</span>
                      ) : remaining > 0 ? (
                        <span className="low-stock-badge">{remaining} left</span>
                      ) : (
                        <span className="out-of-stock-badge">over by {-remaining}</span>
                      )}
                    </td>
                  </>
                ) : (
                  <>
                    <td>{item.keptQty}</td>
                    <td>{item.returnedNormalQty}</td>
                    <td>{item.returnedDamagedQty}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {isActive && (
        <div className="admin-form">
          <p className="help-text">
            Tell the system what the customer decided — how many of each SKU they're keeping, and how many they're
            returning (split by condition). Every held unit must be accounted for before you can process this hold.
          </p>
          {error && (
            <p className="error-text">
              <TriangleAlert size={14} /> {error}
            </p>
          )}
          <button type="button" className="primary" disabled={!allBalanced || submitting} onClick={handleProcess}>
            {submitting ? "Processing..." : "Process hold — generate final bill for kept items"}
          </button>
          {!allBalanced && (
            <p className="muted small" style={{ marginTop: 8 }}>
              <CheckCircle2 size={13} /> Balance every row (Keep + Return normal + Return damaged = Held qty) to
              enable this.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
