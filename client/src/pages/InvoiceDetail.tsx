import { Fragment, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Ban, Download, PlusCircle, RotateCcw, TriangleAlert } from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { StatusBadge } from "../components/StatusBadge";
import type { Invoice, ReturnReason } from "../types";

export function InvoiceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [returningItemId, setReturningItemId] = useState<number | null>(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState<ReturnReason>("normal");
  const [returning, setReturning] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

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

  function startReturn(itemId: number, maxQty: number) {
    setReturningItemId(itemId);
    setReturnQty(Math.min(1, maxQty));
    setReturnReason("normal");
    setReturnError(null);
  }

  async function handleSubmitReturn() {
    if (!returningItemId) return;
    setReturning(true);
    setReturnError(null);
    try {
      await api.post(`/invoices/${invoice!.id}/return`, {
        items: [{ invoiceItemId: returningItemId, qty: returnQty, reason: returnReason }],
      });
      setReturningItemId(null);
      loadInvoice();
    } catch (err) {
      setReturnError(apiErrorMessage(err));
    } finally {
      setReturning(false);
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
            <th>Returnable</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => {
            const returnable = item.qty - item.returnedQty;
            const canReturn = user?.role === "admin" && invoice.status === "paid" && returnable > 0;
            return (
              <Fragment key={item.id}>
                <tr>
                  <td>{item.product.name}</td>
                  <td>{item.qty}</td>
                  <td>₹{Number(item.mrp).toFixed(2)}</td>
                  <td>₹{Number(item.price).toFixed(2)}</td>
                  <td>₹{Number(item.discount).toFixed(2)}</td>
                  <td>₹{Number(item.taxAmount).toFixed(2)}</td>
                  <td>₹{Number(item.lineTotal).toFixed(2)}</td>
                  <td>{returnable}</td>
                  <td>
                    {canReturn && returningItemId !== item.id && (
                      <button type="button" className="link-button" onClick={() => startReturn(item.id, returnable)}>
                        <RotateCcw size={13} /> Return
                      </button>
                    )}
                  </td>
                </tr>
                {returningItemId === item.id && (
                  <tr>
                    <td colSpan={9}>
                      <div className="return-form">
                        <label>
                          Qty to return
                          <input
                            type="number"
                            min={1}
                            max={returnable}
                            value={returnQty}
                            onChange={(e) =>
                              setReturnQty(Math.max(1, Math.min(returnable, Number(e.target.value))))
                            }
                            className="qty-input"
                          />
                        </label>
                        <label>
                          Reason
                          <div className="reason-radios">
                            <label className="radio-option">
                              <input
                                type="radio"
                                checked={returnReason === "normal"}
                                onChange={() => setReturnReason("normal")}
                              />
                              Normal (back to sellable stock)
                            </label>
                            <label className="radio-option">
                              <input
                                type="radio"
                                checked={returnReason === "defective"}
                                onChange={() => setReturnReason("defective")}
                              />
                              Defective (quarantine, not sellable)
                            </label>
                          </div>
                        </label>
                        {returnError && (
                          <p className="error-text">
                            <TriangleAlert size={14} /> {returnError}
                          </p>
                        )}
                        <div style={{ display: "flex", gap: 10 }}>
                          <button type="button" disabled={returning} onClick={handleSubmitReturn}>
                            {returning ? "Processing..." : "Confirm return"}
                          </button>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => setReturningItemId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
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

      {invoice.returns.length > 0 && (
        <div className="returns-history">
          <h3>
            <RotateCcw size={16} /> Return History
          </h3>
          <table className="cart-table">
            <thead>
              <tr>
                <th>Return #</th>
                <th>Date</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Reason</th>
                <th>Refund</th>
              </tr>
            </thead>
            <tbody>
              {invoice.returns.flatMap((ret) =>
                ret.items.map((ri) => (
                  <tr key={ri.id}>
                    <td>{ret.returnNumber}</td>
                    <td>{new Date(ret.createdAt).toLocaleDateString()}</td>
                    <td>{ri.product?.name ?? invoice.items.find((i) => i.id === ri.invoiceItemId)?.product.name}</td>
                    <td>{ri.qty}</td>
                    <td>
                      {ri.reason === "defective" ? (
                        <span className="out-of-stock-badge">defective</span>
                      ) : (
                        <span className="discount-badge">normal</span>
                      )}
                    </td>
                    <td>₹{Number(ri.refundAmount).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
