import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Layers,
  Pencil,
  Package,
  PackagePlus,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import type { Product, StockByWarehouse, Warehouse } from "../types";

const emptyForm = {
  name: "",
  sku: "",
  barcode: "",
  category: "",
  brand: "",
  mrp: "",
  sellingPrice: "",
  taxPercent: "0",
  unit: "pcs",
  imageUrl: "",
};

interface BulkRow {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  mrp: string;
  sellingPrice: string;
  taxPercent: string;
  unit: string;
  initialStock: string;
  error?: string;
}

function makeEmptyBulkRow(id: number): BulkRow {
  return {
    id,
    name: "",
    sku: "",
    barcode: "",
    category: "",
    brand: "",
    mrp: "",
    sellingPrice: "",
    taxPercent: "0",
    unit: "pcs",
    initialStock: "",
  };
}

export function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [initialStock, setInitialStock] = useState<Record<number, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [stockByProduct, setStockByProduct] = useState<Record<number, StockByWarehouse[]>>({});
  const [stockLoadingId, setStockLoadingId] = useState<number | null>(null);

  const bulkRowIdRef = useRef(0);
  function nextBulkRowId() {
    bulkRowIdRef.current += 1;
    return bulkRowIdRef.current;
  }
  const [bulkWarehouseId, setBulkWarehouseId] = useState<number | "">("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>(() =>
    Array.from({ length: 3 }, () => makeEmptyBulkRow(++bulkRowIdRef.current))
  );
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);

  async function loadProducts() {
    const res = await api.get<Product[]>("/products");
    setProducts(res.data);
  }

  useEffect(() => {
    loadProducts();
    api.get<Warehouse[]>("/warehouses").then((res) => {
      setWarehouses(res.data);
      const defaultWarehouse = res.data.find((w) => w.name === "Warehouse") ?? res.data[0];
      if (defaultWarehouse) setBulkWarehouseId(defaultWarehouse.id);
    });
  }, []);

  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      category: product.category ?? "",
      brand: product.brand ?? "",
      mrp: String(product.mrp),
      sellingPrice: String(product.sellingPrice),
      taxPercent: String(product.taxPercent),
      unit: product.unit,
      imageUrl: product.imageUrl ?? "",
    });
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setInitialStock({});
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/products/${editingId}`, {
          name: form.name,
          category: form.category || undefined,
          brand: form.brand || undefined,
          mrp: Number(form.mrp),
          sellingPrice: Number(form.sellingPrice),
          taxPercent: Number(form.taxPercent),
          unit: form.unit,
          imageUrl: form.imageUrl || undefined,
        });
        setSuccess(`Product "${form.name}" updated.`);
        setEditingId(null);
        setForm(emptyForm);
      } else {
        await api.post("/products", {
          name: form.name,
          sku: form.sku,
          barcode: form.barcode,
          category: form.category || undefined,
          brand: form.brand || undefined,
          mrp: Number(form.mrp),
          sellingPrice: Number(form.sellingPrice),
          taxPercent: Number(form.taxPercent),
          unit: form.unit,
          imageUrl: form.imageUrl || undefined,
          initialStock: Object.entries(initialStock)
            .filter(([, qty]) => qty.trim() !== "")
            .map(([warehouseId, qty]) => ({
              warehouseId: Number(warehouseId),
              quantity: Number(qty),
              reorderLevel: 0,
            })),
        });
        setSuccess(`Product "${form.name}" created.`);
        setForm(emptyForm);
        setInitialStock({});
      }
      loadProducts();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function addBulkRow() {
    setBulkRows((prev) => [...prev, makeEmptyBulkRow(nextBulkRowId())]);
  }

  function updateBulkRow(id: number, patch: Partial<BulkRow>) {
    setBulkRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, error: undefined } : r)));
  }

  function removeBulkRow(id: number) {
    setBulkRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleBulkSubmit() {
    setBulkSummary(null);

    // Rows with nothing filled in at all are just unused blanks — skip them silently.
    const isBlank = (r: BulkRow) => !r.name.trim() && !r.barcode.trim();
    const submittable = bulkRows.filter((r) => !isBlank(r));

    // Rows missing a required field never leave the browser — flag them locally.
    const locallyInvalid = new Set<number>();
    for (const r of submittable) {
      if (!r.name.trim() || !r.barcode.trim() || !r.mrp.trim() || !r.sellingPrice.trim()) {
        locallyInvalid.add(r.id);
      }
    }
    if (locallyInvalid.size > 0) {
      setBulkRows((prev) =>
        prev.map((r) => (locallyInvalid.has(r.id) ? { ...r, error: "Name, barcode, MRP and price are required" } : r))
      );
    }

    const toSend = submittable.filter((r) => !locallyInvalid.has(r.id));
    if (toSend.length === 0) return;

    setBulkSubmitting(true);
    try {
      const res = await api.post<{
        results: Array<{ index: number; success: true } | { index: number; success: false; error: string }>;
      }>("/products/bulk", {
        warehouseId: bulkWarehouseId || undefined,
        products: toSend.map((r) => ({
          name: r.name,
          sku: r.sku.trim() || undefined,
          barcode: r.barcode,
          category: r.category || undefined,
          brand: r.brand || undefined,
          mrp: Number(r.mrp),
          sellingPrice: Number(r.sellingPrice),
          taxPercent: Number(r.taxPercent || 0),
          unit: r.unit || "pcs",
          initialStock: r.initialStock.trim() !== "" ? Number(r.initialStock) : undefined,
        })),
      });

      const succeededIds = new Set<number>();
      const errorById = new Map<number, string>();
      res.data.results.forEach((result) => {
        const row = toSend[result.index];
        if (!row) return;
        if (result.success) {
          succeededIds.add(row.id);
        } else {
          errorById.set(row.id, result.error);
        }
      });

      setBulkRows((prev) =>
        prev.filter((r) => !succeededIds.has(r.id)).map((r) => (errorById.has(r.id) ? { ...r, error: errorById.get(r.id) } : r))
      );
      setBulkSummary(`${succeededIds.size} saved, ${errorById.size} failed.`);
      if (succeededIds.size > 0) loadProducts();
    } catch (err) {
      setBulkSummary(apiErrorMessage(err));
    } finally {
      setBulkSubmitting(false);
    }
  }

  async function toggleStock(productId: number) {
    if (expandedProductId === productId) {
      setExpandedProductId(null);
      return;
    }
    setExpandedProductId(productId);
    if (!stockByProduct[productId]) {
      setStockLoadingId(productId);
      try {
        const res = await api.get<StockByWarehouse[]>(`/products/${productId}/stock`);
        setStockByProduct((prev) => ({ ...prev, [productId]: res.data }));
      } finally {
        setStockLoadingId(null);
      }
    }
  }

  return (
    <div className="admin-page">
      <h2>
        <Package size={19} /> Products
      </h2>

      <form className="admin-form" onSubmit={handleSubmit}>
        <h3>
          {editingId ? (
            <>
              <Pencil size={16} /> Edit product
            </>
          ) : (
            <>
              <PackagePlus size={16} /> Add new product
            </>
          )}
        </h3>
        <div className="form-grid">
          <label>
            Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            SKU
            <input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              required
              disabled={!!editingId}
            />
          </label>
          <label>
            Barcode
            <input
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              required
              disabled={!!editingId}
            />
          </label>
          <label>
            Category
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </label>
          <label>
            Brand
            <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          </label>
          <label>
            MRP
            <input
              type="number"
              min={0}
              value={form.mrp}
              onChange={(e) => setForm({ ...form, mrp: e.target.value })}
              required
            />
          </label>
          <label>
            Selling price
            <input
              type="number"
              min={0}
              value={form.sellingPrice}
              onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
              required
            />
          </label>
          <label>
            Tax %
            <input
              type="number"
              min={0}
              max={100}
              value={form.taxPercent}
              onChange={(e) => setForm({ ...form, taxPercent: e.target.value })}
            />
          </label>
          <label>
            Unit
            <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </label>
          <label>
            Image URL
            <input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
          </label>
        </div>

        {!editingId && (
          <>
            <h4>Initial stock (optional)</h4>
            <div className="form-grid">
              {warehouses.map((w) => (
                <label key={w.id}>
                  {w.name}
                  <input
                    type="number"
                    min={0}
                    value={initialStock[w.id] ?? ""}
                    onChange={(e) => setInitialStock({ ...initialStock, [w.id]: e.target.value })}
                  />
                </label>
              ))}
            </div>
          </>
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
        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? "Saving..." : editingId ? "Update product" : "Save product"}
          </button>
          {editingId && (
            <button type="button" className="link-button" onClick={cancelEdit}>
              <X size={14} /> Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="admin-form">
        <h3>
          <Layers size={16} /> Bulk add products
        </h3>
        <p className="help-text">
          Add several products at once — fill in as many rows as you need. Leave <strong>SKU</strong> blank to
          auto-generate one. Rows that fail (e.g. duplicate barcode) stay in the table with the reason shown, so you
          only need to fix and resubmit those.
        </p>

        <label style={{ maxWidth: 260, marginBottom: 12 }}>
          Add initial stock to warehouse
          <select value={bulkWarehouseId} onChange={(e) => setBulkWarehouseId(Number(e.target.value))}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>

        <div className="bulk-table-wrap">
          <table className="cart-table bulk-table">
            <thead>
              <tr>
                <th>Name *</th>
                <th>SKU</th>
                <th>Barcode *</th>
                <th>Category</th>
                <th>Brand</th>
                <th>MRP *</th>
                <th>Price *</th>
                <th>Tax %</th>
                <th>Unit</th>
                <th>Initial stock</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bulkRows.map((row) => (
                <tr key={row.id} className={row.error ? "bulk-row-error" : ""}>
                  <td>
                    <input value={row.name} onChange={(e) => updateBulkRow(row.id, { name: e.target.value })} />
                  </td>
                  <td>
                    <input
                      placeholder="auto"
                      value={row.sku}
                      onChange={(e) => updateBulkRow(row.id, { sku: e.target.value })}
                    />
                  </td>
                  <td>
                    <input value={row.barcode} onChange={(e) => updateBulkRow(row.id, { barcode: e.target.value })} />
                  </td>
                  <td>
                    <input value={row.category} onChange={(e) => updateBulkRow(row.id, { category: e.target.value })} />
                  </td>
                  <td>
                    <input value={row.brand} onChange={(e) => updateBulkRow(row.id, { brand: e.target.value })} />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      className="qty-input"
                      value={row.mrp}
                      onChange={(e) => updateBulkRow(row.id, { mrp: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      className="qty-input"
                      value={row.sellingPrice}
                      onChange={(e) => updateBulkRow(row.id, { sellingPrice: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="qty-input"
                      value={row.taxPercent}
                      onChange={(e) => updateBulkRow(row.id, { taxPercent: e.target.value })}
                    />
                  </td>
                  <td>
                    <input className="qty-input" value={row.unit} onChange={(e) => updateBulkRow(row.id, { unit: e.target.value })} />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      className="qty-input"
                      value={row.initialStock}
                      onChange={(e) => updateBulkRow(row.id, { initialStock: e.target.value })}
                      disabled={!bulkWarehouseId}
                    />
                  </td>
                  <td>
                    <button type="button" className="link-button" onClick={() => removeBulkRow(row.id)}>
                      <X size={13} />
                    </button>
                    {row.error && (
                      <p className="error-text bulk-row-error-text">
                        <TriangleAlert size={12} /> {row.error}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
          <button type="button" className="link-button" onClick={addBulkRow}>
            <Plus size={14} /> Add row
          </button>
          <button type="button" className="primary" disabled={bulkSubmitting} onClick={handleBulkSubmit}>
            {bulkSubmitting ? "Saving..." : "Save all"}
          </button>
        </div>

        {bulkSummary && (
          <p className={bulkSummary.endsWith("0 failed.") ? "success-text" : "error-text"}>
            {bulkSummary.endsWith("0 failed.") ? <CheckCircle2 size={14} /> : <TriangleAlert size={14} />} {bulkSummary}
          </p>
        )}
      </div>

      <h3>Existing products</h3>
      <table className="cart-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>SKU</th>
            <th>Barcode</th>
            <th>MRP</th>
            <th>Price</th>
            <th>Tax %</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <Fragment key={p.id}>
              <tr>
                <td>
                  <button type="button" className="product-name-toggle" onClick={() => toggleStock(p.id)}>
                    {expandedProductId === p.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {p.name}
                  </button>
                </td>
                <td>{p.sku}</td>
                <td>{p.barcode}</td>
                <td>₹{Number(p.mrp).toFixed(2)}</td>
                <td>₹{Number(p.sellingPrice).toFixed(2)}</td>
                <td>{Number(p.taxPercent)}%</td>
                <td>
                  <button type="button" className="link-button" onClick={() => startEdit(p)}>
                    <Pencil size={13} /> Edit
                  </button>
                </td>
              </tr>
              {expandedProductId === p.id && (
                <tr>
                  <td colSpan={7} className="stock-expand-cell">
                    {stockLoadingId === p.id ? (
                      <p className="muted small">Loading stock...</p>
                    ) : (
                      <table className="stock-table">
                        <thead>
                          <tr>
                            <th>Warehouse / Showroom</th>
                            <th>Available stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(stockByProduct[p.id] ?? []).map((s) => (
                            <tr key={s.warehouseId}>
                              <td>{s.warehouseName}</td>
                              <td>{s.quantity}</td>
                            </tr>
                          ))}
                          {(stockByProduct[p.id] ?? []).length === 0 && (
                            <tr>
                              <td colSpan={2} className="muted small">
                                No stock recorded for this product at any warehouse yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
