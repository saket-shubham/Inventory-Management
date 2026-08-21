import { ShoppingBag, X } from "lucide-react";
import { useCart } from "../context/CartContext";

export function CartTable() {
  const { lines, updateQty, updateDiscount, removeItem } = useCart();

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
        {lines.map((line) => {
          const price = Number(line.product.sellingPrice);
          const lineBase = price * line.qty;
          const itemDiscount = Math.min(line.discount, lineBase);
          const discountedBase = lineBase - itemDiscount;
          const tax = (discountedBase * Number(line.product.taxPercent)) / 100;
          const lineTotal = discountedBase + tax;
          return (
            <tr key={line.product.id}>
              <td>{line.product.name}</td>
              <td>
                <input
                  type="number"
                  min={1}
                  max={line.availableAtBillingWarehouse}
                  value={line.qty}
                  onChange={(e) => updateQty(line.product.id, Number(e.target.value))}
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
                  value={line.discount}
                  onChange={(e) => updateDiscount(line.product.id, Number(e.target.value))}
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
        })}
      </tbody>
    </table>
  );
}
