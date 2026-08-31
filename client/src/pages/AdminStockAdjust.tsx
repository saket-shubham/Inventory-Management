import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Boxes, CheckCircle2, PackageX, TriangleAlert } from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import type { Product, StockByWarehouse, Warehouse } from "../types";

export function AdminStockAdjust() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stock, setStock] = useState<StockByWarehouse[]>([]);

  const [mode, setMode] = useState<"adjust" | "transfer" | "damage">("adjust");

  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [changeQty, setChangeQty] = useState("");
  const [reorderLevel, setReorderLevel] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const [fromWarehouseId, setFromWarehouseId] = useState<number | "">("");
  const [toWarehouseId, setToWarehouseId] = useState<number | "">("");
  const [transferQty, setTransferQty] = useState("");
  const [transferReason, setTransferReason] = useState("");

  const [damageWarehouseId, setDamageWarehouseId] = useState<number | "">("");
  const [damageQty, setDamageQty] = useState("");

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

  async function handleSearchEnter() {
    if (!search.trim()) return;
    const res = await api.get<Product[]>("/products", { params: { search } });
    setResults(res.data);
    if (res.data.length === 1) {
      selectProduct(res.data[0]);
    }
  }

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
        ...(adjustReason.trim() !== "" ? { reason: adjustReason.trim() } : {}),
      });
      setMessage("Stock adjusted.");
      setChangeQty("");
      setAdjustReason("");
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
      await api.post("/stock/transfer", {
        productId: selectedProduct.id,
        fromWarehouseId,
        toWarehouseId,
        qty,
        ...(transferReason.trim() !== "" ? { reason: transferReason.trim() } : {}),
      });
      setMessage("Stock transferred.");
      setTransferQty("");
      setTransferReason("");
      refreshStock();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkDamaged() {
    if (!selectedProduct || !damageWarehouseId || !damageQty) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await api.post("/stock/mark-damaged", {
        productId: selectedProduct.id,
        warehouseId: damageWarehouseId,
        qty: Number(damageQty),
      });
      setMessage("Marked as damaged — moved out of sellable stock. Send it back from Purchases → Return to Supplier.");
      setDamageQty("");
      refreshStock();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const damageWarehouseStock = stock.find((s) => s.warehouseId === damageWarehouseId);

  return (
    <div className="admin-page">
      <h2>
        <Boxes size={19} /> Stock Adjustment
      </h2>

      <label className="product-search">
        Search product by name / SKU / barcode
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearchEnter();
            }
          }}
        />
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
                <th>Sellable qty</th>
                <th>Damaged qty</th>
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
                  <td>
                    {s.damagedQuantity ?? 0}
                    {!!s.damagedQuantity && <span className="out-of-stock-badge">damaged</span>}
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
            <button type="button" className={mode === "damage" ? "active" : ""} onClick={() => setMode("damage")}>
              Mark Damaged
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
              <label>
                Reason (optional)
                <input
                  type="text"
                  placeholder="e.g. Physical stock count"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                />
              </label>
              <button type="button" className="primary" disabled={submitting} onClick={handleAdjust}>
                Apply adjustment
              </button>
            </div>
          ) : mode === "transfer" ? (
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
              <label>
                Reason (optional)
                <input
                  type="text"
                  placeholder="e.g. Rebalancing showroom stock"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                />
              </label>
              <button type="button" className="primary" disabled={submitting} onClick={handleTransfer}>
                Transfer
              </button>
            </div>
          ) : (
            <div>
              <p className="help-text">
                <PackageX size={14} /> Use this when you find a broken/defective piece in your own stock (not a
                customer return). It moves units from <strong>sellable</strong> stock into a{" "}
                <strong>damaged</strong> holding area — they can no longer be sold. To send them back to the
                supplier afterwards, go to{" "}
                <Link to="/admin/purchases" className="inline-link">
                  Purchases → Return to Supplier
                </Link>
                .
              </p>
              <div className="form-grid">
                <label>
                  Warehouse
                  <select value={damageWarehouseId} onChange={(e) => setDamageWarehouseId(Number(e.target.value))}>
                    <option value="">Select</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Qty to mark damaged
                  <input
                    type="number"
                    min={1}
                    max={damageWarehouseStock?.quantity ?? undefined}
                    value={damageQty}
                    onChange={(e) => setDamageQty(e.target.value)}
                  />
                  {damageWarehouseStock && (
                    <span className="muted small">{damageWarehouseStock.quantity} sellable available</span>
                  )}
                </label>
                <button type="button" className="danger-button" disabled={submitting} onClick={handleMarkDamaged}>
                  Mark as damaged
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="error-text">
              <TriangleAlert size={14} /> {error}
            </p>
          )}
          {message && (
            <p className="success-text">
              <CheckCircle2 size={14} /> {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
