import { useEffect, useState } from "react";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "../context/CartContext";
import type { CartLine } from "../types";

function CartRow({ line }: { line: CartLine }) {
  const { updateQty, updateDiscount, removeItem } = useCart();

  const [qtyInput, setQtyInput] = useState(String(line.qty));
  const [discountInput, setDiscountInput] = useState(String(line.discount));

  useEffect(() => setQtyInput(String(line.qty)), [line.qty]);
  useEffect(() => setDiscountInput(String(line.discount)), [line.discount]);

  const price = Number(line.product.sellingPrice);
  const lineBase = price * line.qty;
  const itemDiscount = Math.min(line.discount, lineBase);
  const discountedBase = lineBase - itemDiscount;
  const tax = (discountedBase * Number(line.product.taxPercent)) / 100;
  const lineTotal = discountedBase + tax;

  function commitQty() {
    const parsed = Number(qtyInput);
    if (qtyInput.trim() === "" || Number.isNaN(parsed)) {
      setQtyInput(String(line.qty));
      return;
    }
    updateQty(line.product.id, parsed);
  }

  function handleIncrement() {
    const next = Math.min(line.availableAtBillingWarehouse, line.qty + 1);
    setQtyInput(String(next));
    updateQty(line.product.id, next);
  }

  function handleDecrement() {
    const next = Math.max(1, line.qty - 1);
    setQtyInput(String(next));
    updateQty(line.product.id, next);
  }

  function commitDiscount() {
    const parsed = Number(discountInput);
    if (discountInput.trim() === "" || Number.isNaN(parsed)) {
      setDiscountInput(String(line.discount));
      return;
    }
    updateDiscount(line.product.id, parsed);
  }

  const isOutOfStock = line.availableAtBillingWarehouse <= 0;
  const canIncrement = line.qty < line.availableAtBillingWarehouse;
  const canDecrement = line.qty > 1;

  return (
    <tr>
      <td>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ fontSize: "13.5px", color: "var(--text)" }}>{line.product.name}</strong>
          <span className="muted small" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span>SKU: {line.product.sku}</span>
            {line.barcodeScanned && (
              <span className="sidebar-badge" style={{ fontSize: "10px", padding: "1px 6px" }}>
                {line.barcodeScanned}
              </span>
            )}
          </span>
        </div>
      </td>
      <td>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div className="qty-stepper">
            <button
              type="button"
              className="qty-stepper-btn"
              disabled={!canDecrement || isOutOfStock}
              onClick={handleDecrement}
              title="Decrease quantity"
            >
              <Minus size={12} />
            </button>
            <input
              type="number"
              min={1}
              max={line.availableAtBillingWarehouse}
              value={qtyInput}
              onChange={(e) => setQtyInput(e.target.value)}
              onBlur={commitQty}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitQty();
                }
              }}
              className="qty-stepper-input"
            />
            <button
              type="button"
              className="qty-stepper-btn"
              disabled={!canIncrement || isOutOfStock}
              onClick={handleIncrement}
              title="Increase quantity"
            >
              <Plus size={12} />
            </button>
          </div>
          <span className="muted small" style={{ fontSize: "10.5px" }}>
            {line.availableAtBillingWarehouse} in stock
          </span>
        </div>
      </td>
      <td className="num text-right" style={{ fontWeight: 600 }}>
        ₹{price.toFixed(2)}
      </td>
      <td className="text-right">
        <input
          type="number"
          min={0}
          max={lineBase}
          value={discountInput}
          onChange={(e) => setDiscountInput(e.target.value)}
          onBlur={commitDiscount}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDiscount();
            }
          }}
          className="qty-stepper-input"
          style={{
            width: 60,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "4px 6px",
            textAlign: "right",
          }}
        />
      </td>
      <td className="num text-right muted small">₹{tax.toFixed(2)}</td>
      <td className="num text-right" style={{ fontWeight: 700, color: "var(--brand-700)" }}>
        ₹{lineTotal.toFixed(2)}
      </td>
      <td className="text-center">
        <button
          type="button"
          className="action-icon-btn"
          onClick={() => removeItem(line.product.id)}
          title="Remove from cart"
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}

export function CartTable() {
  const { lines } = useCart();

  if (lines.length === 0) {
    return (
      <div className="empty-state">
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--chip-bg-strong)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--brand-500)",
          }}
        >
          <ShoppingBag size={26} strokeWidth={1.8} />
        </div>
        <div style={{ textAlign: "center" }}>
          <strong style={{ display: "block", color: "var(--text)", fontSize: "15px", marginBottom: 3 }}>
            Cart is empty
          </strong>
          <p className="muted small" style={{ margin: 0 }}>
            Scan a barcode or search for products on the left.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", margin: "10px 0" }}>
      <table className="cart-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th className="num text-right">Price</th>
            <th className="num text-right">Disc (₹)</th>
            <th className="num text-right">Tax</th>
            <th className="num text-right">Total</th>
            <th className="text-center" style={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <CartRow key={line.product.id} line={line} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
