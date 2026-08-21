import { useEffect, useState } from "react";
import { CheckCircle2, PackageSearch, Plus, ShoppingBasket, TriangleAlert, Truck, X } from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import type { Product, Purchase, Supplier, Warehouse } from "../types";

interface PurchaseLine {
  product: Product;
  qty: number;
  costPrice: number;
}

export function AdminPurchases() {
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

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadPurchases() {
    api.get<Purchase[]>("/purchases").then((res) => setPurchases(res.data));
  }

  useEffect(() => {
    api.get<Warehouse[]>("/warehouses").then((res) => setWarehouses(res.data));
    loadPurchases();
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
      return [...prev, { product, qty: 1, costPrice: Number(product.sellingPrice) }];
    });
    setProductSearch("");
    setProductResults([]);
  }

  function updateLine(productId: number, patch: Partial<PurchaseLine>) {
    setLines((prev) => prev.map((l) => (l.product.id === productId ? { ...l, ...patch } : l)));
  }

  function removeLine(productId: number) {
    setLines((prev) => prev.filter((l) => l.product.id !== productId));
  }

  const totalAmount = lines.reduce((sum, l) => sum + l.qty * l.costPrice, 0);

  async function handleSubmit() {
    if (!warehouseId || lines.length === 0) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post<Purchase>("/purchases", {
        warehouseId,
        supplierId: selectedSupplier?.id,
        items: lines.map((l) => ({ productId: l.product.id, qty: l.qty, costPrice: l.costPrice })),
      });
      setSuccess(`Purchase ${res.data.purchaseNumber} recorded — stock updated.`);
      setLines([]);
      setSelectedSupplier(null);
      loadPurchases();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-page">
      <h2>
        <Truck size={19} /> Purchases (Stock-In)
      </h2>

      <div className="admin-form">
        <h3>
          <ShoppingBasket size={16} /> New purchase
        </h3>

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
        </div>

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

        <h4 style={{ marginTop: 18 }}>
          <PackageSearch size={15} /> Add products
        </h4>
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
          <table className="cart-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Cost price</th>
                <th>Line total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.product.id}>
                  <td>{l.product.name}</td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      value={l.qty}
                      onChange={(e) => updateLine(l.product.id, { qty: Math.max(1, Number(e.target.value)) })}
                      className="qty-input"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={l.costPrice}
                      onChange={(e) => updateLine(l.product.id, { costPrice: Math.max(0, Number(e.target.value)) })}
                      className="qty-input"
                    />
                  </td>
                  <td>₹{(l.qty * l.costPrice).toFixed(2)}</td>
                  <td>
                    <button type="button" className="link-button" onClick={() => removeLine(l.product.id)}>
                      <X size={13} /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          disabled={!warehouseId || lines.length === 0 || submitting}
          onClick={handleSubmit}
        >
          {submitting ? "Recording..." : "Record purchase"}
        </button>
      </div>

      <h3>Recent purchases</h3>
      <table className="cart-table">
        <thead>
          <tr>
            <th>PO #</th>
            <th>Date</th>
            <th>Supplier</th>
            <th>Warehouse</th>
            <th>Items</th>
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
              <td>{p.supplier?.name ?? "—"}</td>
              <td>{p.warehouse.name}</td>
              <td>{p.items.length}</td>
              <td>₹{Number(p.totalAmount).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
