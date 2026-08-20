import { useCart } from "../context/CartContext";

export function CartTable() {
  const { lines, updateQty, removeItem } = useCart();

  if (lines.length === 0) {
    return <p className="muted">Cart is empty. Scan a product to add it.</p>;
  }

  return (
    <table className="cart-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Tax</th>
          <th>Line total</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => {
          const price = Number(line.product.sellingPrice);
          const tax = (price * line.qty * Number(line.product.taxPercent)) / 100;
          const lineTotal = price * line.qty + tax;
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
              <td>₹{tax.toFixed(2)}</td>
              <td>₹{lineTotal.toFixed(2)}</td>
              <td>
                <button type="button" className="link-button" onClick={() => removeItem(line.product.id)}>
                  Remove
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
