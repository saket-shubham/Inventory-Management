import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  PackageSearch,
  Plus,
  RotateCcw,
  ShoppingBasket,
  TriangleAlert,
  Truck,
  X,
} from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import type { DamagedStockRow, Product, Purchase, Supplier, SupplierReturn, Warehouse } from "../types";

interface PurchaseLine {
  product: Product;
  totalQty: string;
  costPrice: string;
  allocations: Record<number, string>;
}

interface ReturnLine {
  productId: number;
  productName: string;
  sku: string;
  qty: number;
  maxQty: number;
}

export function AdminPurchases() {
  const [mode, setMode] = useState<"purchase" | "return">("purchase");

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<number | "">("");

  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierResults, setSupplierResults] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [newSupplierMode, setNewSupplierMode] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");

  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [lines, setLines] = useState<PurchaseLine[]>([]);

  const [damagedStock, setDamagedStock] = useState<DamagedStockRow[]>([]);
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [supplierReturns, setSupplierReturns] = useState<SupplierReturn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadPurchases() {
    api.get<Purchase[]>("/purchases").then((res) => setPurchases(res.data));
  }

  function loadSupplierReturns() {
    api.get<SupplierReturn[]>("/supplier-returns").then((res) => setSupplierReturns(res.data));
  }

  useEffect(() => {
    api.get<Warehouse[]>("/warehouses").then((res) => setWarehouses(res.data));
    loadPurchases();
    loadSupplierReturns();
    api.get<DamagedStockRow[]>("/stock/damaged").then((res) => setDamagedStock(res.data));
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (!supplierSearch.trim()) {
        setSupplierResults([]);
        return;
      }
      api.get<Supplier[]>("/suppliers", { params: { search: supplierSearch } }).then((res) => setSupplierResults(res.data));
    }, 250);
    return () => clearTimeout(handle);
  }, [supplierSearch]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (!productSearch.trim()) {
        setProductResults([]);
        return;
      }
      api.get<Product[]>("/products", { params: { search: productSearch } }).then((res) => setProductResults(res.data));
    }, 250);
    return () => clearTimeout(handle);
  }, [productSearch]);

  async function createNewSupplier() {
    const res = await api.post<Supplier>("/suppliers", { name: newSupplierName, phone: newSupplierPhone });
    setSelectedSupplier(res.data);
    setNewSupplierMode(false);
    setSupplierSearch("");
  }

  function addProductLine(product: Product) {
    setLines((prev) => {
      if (prev.some((l) => l.product.id === product.id)) return prev;
      return [...prev, { product, totalQty: "", costPrice: String(product.sellingPrice), allocations: {} }];
    });
    setProductSearch("");
    setProductResults([]);
  }

  function updateLine(productId: number, patch: Partial<PurchaseLine>) {
    setLines((prev) => prev.map((l) => (l.product.id === productId ? { ...l, ...patch } : l)));
  }

  function updateAllocation(productId: number, warehouseIdKey: number, value: string) {
    setLines((prev) =>
      prev.map((l) =>
        l.product.id === productId ? { ...l, allocations: { ...l.allocations, [warehouseIdKey]: value } } : l
      )
    );
  }

  function removeLine(productId: number) {
    setLines((prev) => prev.filter((l) => l.product.id !== productId));
  }

  function lineAllocated(line: PurchaseLine): number {
    return warehouses.reduce((sum, w) => sum + (Number(line.allocations[w.id]) || 0), 0);
  }

  function lineRemaining(line: PurchaseLine): number {
    return (Number(line.totalQty) || 0) - lineAllocated(line);
  }

  const totalAmount = lines.reduce((sum, l) => sum + (Number(l.totalQty) || 0) * (Number(l.costPrice) || 0), 0);
  const linesBalanced = lines.length > 0 && lines.every((l) => Number(l.totalQty) > 0 && lineRemaining(l) === 0);

  async function handleSubmit() {
    if (!linesBalanced) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const savedPOs: string[] = [];
    try {
      for (const w of warehouses) {
        const items = lines
          .map((l) => ({ productId: l.product.id, qty: Number(l.allocations[w.id]) || 0, costPrice: Number(l.costPrice) || 0 }))
          .filter((i) => i.qty > 0);
        if (items.length === 0) continue;

        const res = await api.post<Purchase>("/purchases", {
          warehouseId: w.id,
          supplierId: selectedSupplier?.id,
          items,
        });
        savedPOs.push(`${res.data.purchaseNumber} (${w.name})`);
      }
      setSuccess(`Recorded ${savedPOs.length} purchase${savedPOs.length !== 1 ? "s" : ""}: ${savedPOs.join(", ")}`);
      setLines([]);
      setSelectedSupplier(null);
      loadPurchases();
    } catch (err) {
      setError(
        (savedPOs.length > 0 ? `Saved so far: ${savedPOs.join(", ")}. ` : "") + apiErrorMessage(err)
      );
    } finally {
      setSubmitting(false);
    }
  }

  const damagedAtWarehouse = damagedStock.filter((d) => d.warehouseId === warehouseId);

  function addReturnLine(row: DamagedStockRow) {
    setReturnLines((prev) => {
      if (prev.some((l) => l.productId === row.productId)) return prev;
      return [...prev, { productId: row.productId, productName: row.productName, sku: row.sku, qty: 1, maxQty: row.damagedQuantity }];
    });
  }

  function updateReturnLine(productId: number, qty: number) {
    setReturnLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, qty: Math.max(1, Math.min(qty, l.maxQty)) } : l))
    );
  }

  function removeReturnLine(productId: number) {
    setReturnLines((prev) => prev.filter((l) => l.productId !== productId));
  }

  async function handleSubmitReturn() {
    if (!warehouseId || returnLines.length === 0) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post<SupplierReturn>("/supplier-returns", {
        warehouseId,
        supplierId: selectedSupplier?.id,
        items: returnLines.map((l) => ({ productId: l.productId, qty: l.qty })),
      });
      setSuccess(`Supplier return ${res.data.returnNumber} recorded — damaged stock cleared.`);
      setReturnLines([]);
      setSelectedSupplier(null);
      loadSupplierReturns();
      api.get<DamagedStockRow[]>("/stock/damaged").then((res) => setDamagedStock(res.data));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const supplierPicker = (
    <>
      <h4>Supplier (optional)</h4>
      {selectedSupplier ? (
        <div className="selected-customer">
          {selectedSupplier.name} {selectedSupplier.phone ? `(${selectedSupplier.phone})` : ""}
          <button type="button" className="link-button" onClick={() => setSelectedSupplier(null)}>
            Change
          </button>
        </div>
      ) : newSupplierMode ? (
        <div className="new-customer-form">
          <input placeholder="Name" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} />
          <input placeholder="Phone" value={newSupplierPhone} onChange={(e) => setNewSupplierPhone(e.target.value)} />
          <button type="button" disabled={!newSupplierName.trim()} onClick={createNewSupplier}>
            Save supplier
          </button>
          <button type="button" className="link-button" onClick={() => setNewSupplierMode(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <>
          <input
            placeholder="Search supplier by name/phone"
            value={supplierSearch}
            onChange={(e) => setSupplierSearch(e.target.value)}
          />
          {supplierResults.length > 0 && (
            <ul className="customer-results">
              {supplierResults.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setSelectedSupplier(s);
                      setSupplierSearch("");
                      setSupplierResults([]);
                    }}
                  >
                    {s.name} {s.phone ? `(${s.phone})` : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="link-button" onClick={() => setNewSupplierMode(true)}>
            <Plus size={13} /> New supplier
          </button>
        </>
      )}
    </>
  );

  return (
    <div className="admin-page">
      <h2>
        <Truck size={19} /> Purchases (Stock-In)
      </h2>

      <div className="mode-toggle">
        <button type="button" className={mode === "purchase" ? "active" : ""} onClick={() => setMode("purchase")}>
          New Purchase
        </button>
        <button type="button" className={mode === "return" ? "active" : ""} onClick={() => setMode("return")}>
          Return to Supplier
        </button>
      </div>

      {mode === "purchase" ? (
        <div className="admin-form">
          <h3>
            <ShoppingBasket size={16} /> New purchase
          </h3>

          {supplierPicker}

          <h4 style={{ marginTop: 18 }}>
            <PackageSearch size={15} /> Add products
          </h4>
          <p className="help-text">
            <PackageSearch size={14} /> Enter the <strong>total quantity you actually received</strong> per your
            supplier's slip, then split it across warehouses below. The split must add up exactly to the total
            before you can save — no more guessing where everything went.
          </p>
          <input
            placeholder="Search product by name / SKU / barcode"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
          />
          {productResults.length > 0 && (
            <ul className="customer-results">
              {productResults.map((p) => (
                <li key={p.id}>
                  <button type="button" className="link-button" onClick={() => addProductLine(p)}>
                    {p.name} ({p.sku})
                  </button>
                </li>
              ))}
            </ul>
          )}

          {lines.length > 0 && (
            <div className="bulk-table-wrap">
              <table className="cart-table bulk-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Total received</th>
                    <th>Cost price</th>
                    {warehouses.map((w) => (
                      <th key={w.id}>{w.name}</th>
                    ))}
                    <th>Remaining</th>
                    <th>Line total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const remaining = lineRemaining(l);
                    const total = Number(l.totalQty) || 0;
                    const lineTotal = total * (Number(l.costPrice) || 0);
                    return (
                      <tr key={l.product.id} className={remaining !== 0 && total > 0 ? "bulk-row-error" : ""}>
                        <td>{l.product.name}</td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            className="qty-input"
                            value={l.totalQty}
                            onChange={(e) => updateLine(l.product.id, { totalQty: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            className="qty-input"
                            value={l.costPrice}
                            onChange={(e) => updateLine(l.product.id, { costPrice: e.target.value })}
                          />
                        </td>
                        {warehouses.map((w) => (
                          <td key={w.id}>
                            <input
                              type="number"
                              min={0}
                              className="qty-input"
                              value={l.allocations[w.id] ?? ""}
                              onChange={(e) => updateAllocation(l.product.id, w.id, e.target.value)}
                            />
                          </td>
                        ))}
                        <td>
                          {total === 0 ? (
                            <span className="muted small">enter total</span>
                          ) : remaining === 0 ? (
                            <span className="discount-badge">balanced</span>
                          ) : remaining > 0 ? (
                            <span className="low-stock-badge">{remaining} left</span>
                          ) : (
                            <span className="out-of-stock-badge">over by {-remaining}</span>
                          )}
                        </td>
                        <td>₹{lineTotal.toFixed(2)}</td>
                        <td>
                          <button type="button" className="link-button" onClick={() => removeLine(l.product.id)}>
                            <X size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {lines.length > 0 && (
            <div className="invoice-totals">
              <div className="grand-total">
                <span>Total</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}

          {error && (
            <p className="error-text">
              <TriangleAlert size={14} /> {error}
            </p>
          )}
          {success && (
            <p className="success-text">
              <CheckCircle2 size={14} /> {success}
            </p>
          )}
          <button
            type="button"
            className="primary"
            style={{ marginTop: 14 }}
            disabled={!linesBalanced || submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Recording..." : "Record purchase"}
          </button>
        </div>
      ) : (
        <div className="admin-form">
          <h3>
            <RotateCcw size={16} /> Return damaged stock to supplier
          </h3>

          <p className="help-text">
            <PackageSearch size={14} /> Only items already marked <strong>damaged</strong> show up below — you
            can't pick a normal product here. Mark stock as damaged from{" "}
            <Link to="/admin/stock" className="inline-link">
              Stock → Mark Damaged
            </Link>{" "}
            first, or when a customer returns something defective.
          </p>

          <div className="form-grid">
            <label>
              Warehouse
              <select
                value={warehouseId}
                onChange={(e) => {
                  setWarehouseId(Number(e.target.value));
                  setReturnLines([]);
                }}
              >
                <option value="">Select</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {supplierPicker}

          <h4 style={{ marginTop: 18 }}>Damaged stock at this warehouse</h4>
          {!warehouseId ? (
            <p className="muted">Select a warehouse to see its damaged/quarantined stock.</p>
          ) : damagedAtWarehouse.length === 0 ? (
            <p className="muted">Nothing marked damaged at this warehouse right now.</p>
          ) : (
            <ul className="customer-results">
              {damagedAtWarehouse.map((row) => (
                <li key={row.productId}>
                  <button
                    type="button"
                    className="link-button"
                    disabled={returnLines.some((l) => l.productId === row.productId)}
                    onClick={() => addReturnLine(row)}
                  >
                    {row.productName} ({row.sku}) — {row.damagedQuantity} damaged
                  </button>
                </li>
              ))}
            </ul>
          )}

          {returnLines.length > 0 && (
            <table className="cart-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty to return</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {returnLines.map((l) => (
                  <tr key={l.productId}>
                    <td>
                      {l.productName} ({l.sku})
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        max={l.maxQty}
                        value={l.qty}
                        onChange={(e) => updateReturnLine(l.productId, Number(e.target.value))}
                        className="qty-input"
                      />
                      <span className="muted small"> / {l.maxQty} damaged</span>
                    </td>
                    <td>
                      <button type="button" className="link-button" onClick={() => removeReturnLine(l.productId)}>
                        <X size={13} /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {error && (
            <p className="error-text">
              <TriangleAlert size={14} /> {error}
            </p>
          )}
          {success && (
            <p className="success-text">
              <CheckCircle2 size={14} /> {success}
            </p>
          )}
          <button
            type="button"
            className="primary"
            style={{ marginTop: 14 }}
            disabled={!warehouseId || returnLines.length === 0 || submitting}
            onClick={handleSubmitReturn}
          >
            {submitting ? "Recording..." : "Record supplier return"}
          </button>
        </div>
      )}

      <h3>Recent purchases</h3>
      <table className="cart-table">
        <thead>
          <tr>
            <th>PO #</th>
            <th>Date</th>
            <th>Products</th>
            <th>Supplier</th>
            <th>Warehouse</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {purchases.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">
                No purchases recorded yet.
              </td>
            </tr>
          )}
          {purchases.map((p) => (
            <tr key={p.id}>
              <td>{p.purchaseNumber}</td>
              <td>{new Date(p.createdAt).toLocaleDateString()}</td>
              <td>{p.items.map((i) => `${i.product.name} (×${i.qty})`).join(", ")}</td>
              <td>{p.supplier?.name ?? "—"}</td>
              <td>{p.warehouse.name}</td>
              <td>₹{Number(p.totalAmount).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Recent supplier returns</h3>
      <table className="cart-table">
        <thead>
          <tr>
            <th>Return #</th>
            <th>Date</th>
            <th>Products</th>
            <th>Supplier</th>
            <th>Warehouse</th>
          </tr>
        </thead>
        <tbody>
          {supplierReturns.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                No supplier returns recorded yet.
              </td>
            </tr>
          )}
          {supplierReturns.map((r) => (
            <tr key={r.id}>
              <td>{r.returnNumber}</td>
              <td>{new Date(r.createdAt).toLocaleDateString()}</td>
              <td>{r.items.map((i) => `${i.product.name} (×${i.qty})`).join(", ")}</td>
              <td>{r.supplier?.name ?? "—"}</td>
              <td>{r.warehouse.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
