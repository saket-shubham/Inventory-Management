import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, PlusCircle } from "lucide-react";
import { api } from "../api/client";
import type { Invoice } from "../types";

export function InvoiceDetail() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    api.get<Invoice>(`/invoices/${id}`).then((res) => setInvoice(res.data));
  }, [id]);

  if (!invoice) return <div className="page-loading">Loading invoice...</div>;

  const pdfUrl = `${api.defaults.baseURL}/invoices/${invoice.id}/pdf`;

  return (
    <div className="invoice-detail">
      <div className="invoice-detail-header">
        <div>
          <h2>{invoice.invoiceNumber}</h2>
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
        </div>
      </div>

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
