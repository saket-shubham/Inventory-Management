import type { Product } from "../types";

interface ProductLookupCardProps {
  product: Product;
  billingWarehouseId: number | null;
  onAddToCart: () => void;
}

export function ProductLookupCard({ product, billingWarehouseId, onAddToCart }: ProductLookupCardProps) {
  const billingStock = product.stockByWarehouse?.find((s) => s.warehouseId === billingWarehouseId);
  const availableHere = billingStock?.quantity ?? 0;
  const discountPct =
    Number(product.mrp) > 0
      ? Math.round((1 - Number(product.sellingPrice) / Number(product.mrp)) * 100)
      : 0;

  return (
    <div className="product-card">
      <div className="product-card-main">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="product-image" />
        ) : (
          <div className="product-image placeholder">No image</div>
        )}
        <div>
          <h3>{product.name}</h3>
          <p className="muted">
            {product.category ?? "Uncategorized"} {product.brand ? `· ${product.brand}` : ""} · SKU {product.sku}
          </p>
          <div className="price-row">
            <span className="price">₹{Number(product.sellingPrice).toFixed(2)}</span>
            {Number(product.mrp) !== Number(product.sellingPrice) && (
              <>
                <span className="mrp">₹{Number(product.mrp).toFixed(2)}</span>
                <span className="discount-badge">{discountPct}% off</span>
              </>
            )}
            <span className="muted">+{Number(product.taxPercent)}% tax</span>
          </div>
          <button type="button" disabled={availableHere <= 0} onClick={onAddToCart}>
            {availableHere > 0 ? "Add to cart" : "Out of stock here"}
          </button>
        </div>
      </div>

      <table className="stock-table">
        <thead>
          <tr>
            <th>Warehouse / Showroom</th>
            <th>Qty available</th>
          </tr>
        </thead>
        <tbody>
          {product.stockByWarehouse?.map((s) => (
            <tr key={s.warehouseId} className={s.warehouseId === billingWarehouseId ? "current-warehouse" : ""}>
              <td>
                {s.warehouseName}
                {s.warehouseId === billingWarehouseId ? " (billing counter)" : ""}
              </td>
              <td>
                {s.quantity}
                {s.lowStock && s.quantity > 0 && <span className="low-stock-badge">low</span>}
                {s.quantity === 0 && <span className="out-of-stock-badge">out of stock</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
