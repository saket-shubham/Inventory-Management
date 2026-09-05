import { useEffect, useState } from "react";
import { ShoppingBag, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import type { CartLine } from "../types";

function CartRow({ line }: { line: CartLine }) {
  const { updateQty, updateDiscount, removeItem } = useCart();

  // Edited as free-form text locally so the field can be cleared/retyped
  // (e.g. select "1", type "9") without snapping back to the clamped value on
  // every keystroke — the clamp only applies once editing is committed.
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

  function commitDiscount() {
    const parsed = Number(discountInput);
    if (discountInput.trim() === "" || Number.isNaN(parsed)) {
      setDiscountInput(String(line.discount));
      return;
    }
    updateDiscount(line.product.id, parsed);
  }

  return (
    <tr>
      <td>{line.product.name}</td>
      <td>
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
          className="qty-input"
        />
        <span className="muted small"> / {line.availableAtBillingWarehouse} avail.</span>
      </td>
      <td>₹{price.toFixed(2)}</td>
      <td>
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
          className="qty-input"
        />
      </td>
      <td>₹{tax.toFixed(2)}</td>
      <td>₹{lineTotal.toFixed(2)}</td>
      <td>
        <button type="button" className="link-button" onClick={() => removeItem(line.product.id)}>
          <X size={13} /> Remove
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
        <ShoppingBag size={28} strokeWidth={1.6} />
        <p className="muted">Cart is empty. Scan a product to add it.</p>
      </div>
    );
  }

  return (
    <table className="cart-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Discount</th>
          <th>Tax</th>
          <th>Line total</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <CartRow key={line.product.id} line={line} />
        ))}
      </tbody>
    </table>
  );
}
