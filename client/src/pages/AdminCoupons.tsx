import { useEffect, useState, type FormEvent } from "react";
import { Ban, CheckCircle2, Pencil, RotateCcw, Tag, TriangleAlert, X } from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import type { Coupon } from "../types";

const emptyForm = { code: "", discountPercent: "" };

export function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPercent, setEditPercent] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [statusChangingId, setStatusChangingId] = useState<number | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  function loadCoupons() {
    api.get<Coupon[]>("/coupons").then((res) => setCoupons(res.data));
  }

  useEffect(() => {
    loadCoupons();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await api.post("/coupons", {
        code: form.code.trim(),
        discountPercent: Number(form.discountPercent),
      });
      setSuccess(`Coupon "${form.code.trim()}" created.`);
      setForm(emptyForm);
      loadCoupons();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(coupon: Coupon) {
    setEditingId(coupon.id);
    setEditPercent(String(coupon.discountPercent));
    setEditError(null);
  }

  async function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (editingId === null) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      await api.put(`/coupons/${editingId}`, { discountPercent: Number(editPercent) });
      setEditingId(null);
      loadCoupons();
    } catch (err) {
      setEditError(apiErrorMessage(err));
    } finally {
      setEditSubmitting(false);
    }
  }

  async function setActive(id: number, isActive: boolean) {
    setStatusChangingId(id);
    setStatusError(null);
    try {
      await api.put(`/coupons/${id}`, { isActive });
      loadCoupons();
    } catch (err) {
      setStatusError(apiErrorMessage(err));
    } finally {
      setStatusChangingId(null);
    }
  }

  return (
    <div className="admin-page">
      <h2>
        <Tag size={19} /> Discount Coupons
      </h2>

      <form className="admin-form" onSubmit={handleSubmit}>
        <h3>Add new coupon</h3>
        <div className="form-grid">
          <label>
            Coupon code
            <input
              placeholder="e.g. DISCOUNT10 or vivek10"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
            />
          </label>
          <label>
            Discount %
            <input
              type="number"
              min={1}
              max={100}
              step="0.01"
              value={form.discountPercent}
              onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
              required
            />
          </label>
        </div>
        <p className="help-text">
          Codes are matched case-insensitively at billing time — "DISCOUNT10" and "discount10" apply the same coupon.
        </p>
        {error && (
          <p className="error-text">
            <TriangleAlert size={14} /> {error}
          </p>
        )}
        {success && (
          <p className="success-text">
            <CheckCircle2 size={14} /> {success}
          </p>
        )}
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? "Saving..." : "Create coupon"}
        </button>
      </form>

      {editingId !== null && (
        <form className="admin-form" onSubmit={submitEdit}>
          <h3>
            <Pencil size={16} /> Edit discount %
          </h3>
          <div className="form-grid">
            <label>
              Discount %
              <input
                type="number"
                min={1}
                max={100}
                step="0.01"
                value={editPercent}
                onChange={(e) => setEditPercent(e.target.value)}
                required
              />
            </label>
          </div>
          {editError && (
            <p className="error-text">
              <TriangleAlert size={14} /> {editError}
            </p>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" className="primary" disabled={editSubmitting}>
              {editSubmitting ? "Saving..." : "Save changes"}
            </button>
            <button type="button" className="link-button" onClick={() => setEditingId(null)}>
              <X size={14} /> Cancel
            </button>
          </div>
        </form>
      )}

      <h3>All coupons</h3>
      {statusError && (
        <p className="error-text">
          <TriangleAlert size={14} /> {statusError}
        </p>
      )}
      <table className="cart-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Discount %</th>
            <th>Status</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {coupons.map((c) => (
            <tr key={c.id}>
              <td>{c.code}</td>
              <td>{Number(c.discountPercent)}%</td>
              <td>
                {c.isActive ? (
                  <span className="discount-badge">active</span>
                ) : (
                  <span className="out-of-stock-badge">inactive</span>
                )}
              </td>
              <td>{new Date(c.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</td>
              <td className="row-actions">
                <button type="button" className="link-button" onClick={() => startEdit(c)}>
                  <Pencil size={13} /> Edit
                </button>
                {c.isActive ? (
                  <button
                    type="button"
                    className="link-button danger-link"
                    disabled={statusChangingId === c.id}
                    onClick={() => setActive(c.id, false)}
                  >
                    <Ban size={13} /> Deactivate
                  </button>
                ) : (
                  <button
                    type="button"
                    className="link-button"
                    disabled={statusChangingId === c.id}
                    onClick={() => setActive(c.id, true)}
                  >
                    <RotateCcw size={13} /> Reactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
          {coupons.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                No coupons created yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
