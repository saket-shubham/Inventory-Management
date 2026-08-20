import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import type { Product, StockByWarehouse, Warehouse } from "../types";

export function AdminStockAdjust() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stock, setStock] = useState<StockByWarehouse[]>([]);

  const [mode, setMode] = useState<"adjust" | "transfer">("adjust");

  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [changeQty, setChangeQty] = useState("");
  const [reorderLevel, setReorderLevel] = useState("");

  const [fromWarehouseId, setFromWarehouseId] = useState<number | "">("");
  const [toWarehouseId, setToWarehouseId] = useState<number | "">("");
  const [transferQty, setTransferQty] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<Warehouse[]>("/warehouses").then((res) => setWarehouses(res.data));
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (!search.trim()) {
        setResults([]);
        return;
      }
      api.get<Product[]>("/products", { params: { search } }).then((res) => setResults(res.data));
    }, 250);
    return () => clearTimeout(handle);
  }, [search]);

  async function selectProduct(product: Product) {
    setSelectedProduct(product);
    setSearch("");
    setResults([]);
    const res = await api.get<StockByWarehouse[]>(`/products/${product.id}/stock`);
    setStock(res.data);
  }

  async function refreshStock() {
    if (!selectedProduct) return;
    const res = await api.get<StockByWarehouse[]>(`/products/${selectedProduct.id}/stock`);
    setStock(res.data);
  }

  async function handleAdjust() {
    if (!selectedProduct || !warehouseId || !changeQty) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await api.post("/stock/adjust", {
        productId: selectedProduct.id,
        warehouseId,
        changeQty: Number(changeQty),
        ...(reorderLevel.trim() !== "" ? { reorderLevel: Number(reorderLevel) } : {}),
      });
      setMessage("Stock adjusted.");
      setChangeQty("");
      refreshStock();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTransfer() {
    if (!selectedProduct || !fromWarehouseId || !toWarehouseId || !transferQty) return;
    if (fromWarehouseId === toWarehouseId) {
      setError("Source and destination warehouse must differ");
      return;
    }
    const qty = Number(transferQty);
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await api.post("/stock/adjust", { productId: selectedProduct.id, warehouseId: fromWarehouseId, changeQty: -qty });
      await api.post("/stock/adjust", { productId: selectedProduct.id, warehouseId: toWarehouseId, changeQty: qty });
      setMessage("Stock transferred.");
      setTransferQty("");
      refreshStock();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-page">
      <h2>Stock Adjustment</h2>

      <label className="product-search">
        Search product by name / SKU / barcode
        <input value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      {results.length > 0 && (
        <ul className="customer-results">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" className="link-button" onClick={() => selectProduct(p)}>
                {p.name} ({p.sku})
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedProduct && (
        <div className="admin-form">
          <h3>{selectedProduct.name}</h3>

          <table className="stock-table">
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>Qty</th>
                <th>Reorder level</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((s) => (
                <tr key={s.warehouseId} className={s.lowStock ? "current-warehouse" : ""}>
                  <td>{s.warehouseName}</td>
                  <td>
                    {s.quantity}
                    {s.lowStock && <span className="low-stock-badge">low</span>}
                  </td>
                  <td>{s.reorderLevel}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mode-toggle">
            <button type="button" className={mode === "adjust" ? "active" : ""} onClick={() => setMode("adjust")}>
              Adjust
            </button>
            <button type="button" className={mode === "transfer" ? "active" : ""} onClick={() => setMode("transfer")}>
              Transfer between warehouses
            </button>
          </div>

          {mode === "adjust" ? (
            <div className="form-grid">
              <label>
                Warehouse
                <select value={warehouseId} onChange={(e) => setWarehouseId(Number(e.target.value))}>
                  <option value="">Select</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Change qty (+ in / - out)
                <input type="number" value={changeQty} onChange={(e) => setChangeQty(e.target.value)} />
              </label>
              <label>
                New reorder level (optional)
                <input type="number" min={0} value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
              </label>
              <button type="button" className="primary" disabled={submitting} onClick={handleAdjust}>
                Apply adjustment
              </button>
            </div>
          ) : (
            <div className="form-grid">
              <label>
                From warehouse
                <select value={fromWarehouseId} onChange={(e) => setFromWarehouseId(Number(e.target.value))}>
                  <option value="">Select</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                To warehouse
                <select value={toWarehouseId} onChange={(e) => setToWarehouseId(Number(e.target.value))}>
                  <option value="">Select</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quantity
                <input type="number" min={1} value={transferQty} onChange={(e) => setTransferQty(e.target.value)} />
              </label>
              <button type="button" className="primary" disabled={submitting} onClick={handleTransfer}>
                Transfer
              </button>
            </div>
          )}

          {error && <p className="error-text">{error}</p>}
          {message && <p className="success-text">{message}</p>}
        </div>
      )}
    </div>
  );
}
