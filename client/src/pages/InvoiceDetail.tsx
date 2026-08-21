import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Ban, Download, PlusCircle, TriangleAlert } from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { StatusBadge } from "../components/StatusBadge";
import type { Invoice } from "../types";

export function InvoiceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  function loadInvoice() {
    api.get<Invoice>(`/invoices/${id}`).then((res) => setInvoice(res.data));
  }

  useEffect(() => {
    loadInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!invoice) return <div className="page-loading">Loading invoice...</div>;

  const pdfUrl = `${api.defaults.baseURL}/invoices/${invoice.id}/pdf`;

  async function handleCancel() {
    setCancelling(true);
    setCancelError(null);
    try {
      await api.post(`/invoices/${invoice!.id}/cancel`);
      setConfirmingCancel(false);
      loadInvoice();
    } catch (err) {
      setCancelError(apiErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="invoice-detail">
      <div className="invoice-detail-header">
        <div>
          <h2>
            {invoice.invoiceNumber} <StatusBadge status={invoice.status} />
          </h2>
          <p className="muted">
            {new Date(invoice.createdAt).toLocaleString()} · {invoice.warehouse.name}
          </p>
        </div>
        <div className="invoice-actions">
          <a
            className="button-link"
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              // Inject the auth token via a fetch+blob download since the PDF route requires a Bearer token.
              e.preventDefault();
              const token = localStorage.getItem("token");
              fetch(pdfUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
                .then((r) => r.blob())
                .then((blob) => {
                  const url = URL.createObjectURL(blob);
                  window.open(url, "_blank");
                });
            }}
          >
            <Download size={15} /> Download / Print PDF
          </a>
          <Link to="/" className="button-link">
            <PlusCircle size={15} /> New sale
          </Link>
          {user?.role === "admin" && invoice.status === "paid" && !confirmingCancel && (
            <button type="button" className="danger-button" onClick={() => setConfirmingCancel(true)}>
              <Ban size={15} /> Cancel invoice
            </button>
          )}
        </div>
      </div>

      {confirmingCancel && (
        <div className="cancel-confirm">
          <p>
            <TriangleAlert size={15} /> This will mark the invoice as cancelled and add all its items back to stock
            at {invoice.warehouse.name}. This can't be undone. Are you sure?
          </p>
          {cancelError && <p className="error-text">{cancelError}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="danger-button" disabled={cancelling} onClick={handleCancel}>
              {cancelling ? "Cancelling..." : "Yes, cancel invoice"}
            </button>
            <button type="button" className="link-button" onClick={() => setConfirmingCancel(false)}>
              Never mind
            </button>
          </div>
        </div>
      )}

      {invoice.customer && (
        <p>
          <strong>Customer:</strong> {invoice.customer.name} {invoice.customer.phone ?? ""}
        </p>
      )}

      <table className="cart-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>MRP</th>
            <th>Price</th>
            <th>Discount</th>
            <th>Tax</th>
            <th>Line total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.id}>
              <td>{item.product.name}</td>
              <td>{item.qty}</td>
              <td>₹{Number(item.mrp).toFixed(2)}</td>
              <td>₹{Number(item.price).toFixed(2)}</td>
              <td>₹{Number(item.discount).toFixed(2)}</td>
              <td>₹{Number(item.taxAmount).toFixed(2)}</td>
              <td>₹{Number(item.lineTotal).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-totals">
        <div>
          <span>Subtotal</span>
          <span>₹{Number(invoice.subtotal).toFixed(2)}</span>
        </div>
        <div>
          <span>Tax</span>
          <span>₹{Number(invoice.taxAmount).toFixed(2)}</span>
        </div>
        <div>
          <span>Discount</span>
          <span>₹{Number(invoice.discount).toFixed(2)}</span>
        </div>
        <div className="grand-total">
          <span>Grand Total</span>
          <span>₹{Number(invoice.grandTotal).toFixed(2)}</span>
        </div>
        <div>
          <span>Payment mode</span>
          <span>{invoice.paymentMode.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}
