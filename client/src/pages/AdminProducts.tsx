import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Layers,
  Pencil,
  Package,
  PackagePlus,
  Plus,
  RotateCcw,
  TriangleAlert,
  X,
} from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import { ProductImageInput } from "../components/ProductImageInput";
import { BulkImportPanel } from "../components/BulkImportPanel";
import type { MappedImportRow } from "../utils/bulkImport";
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
  imageData: "",
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
  imageUrl: string;
  imageData: string;
  stockTotal: string;
  stockAllocations: Record<number, string>;
  stockAutoFilled: boolean;
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
    imageUrl: "",
    imageData: "",
    stockTotal: "",
    stockAllocations: {},
    stockAutoFilled: true,
  };
}

export function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [stockTotal, setStockTotal] = useState("");
  const [stockAllocations, setStockAllocations] = useState<Record<number, string>>({});
  const [stockAutoFilled, setStockAutoFilled] = useState(true);
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
  const [bulkRows, setBulkRows] = useState<BulkRow[]>(() =>
    Array.from({ length: 3 }, () => makeEmptyBulkRow(++bulkRowIdRef.current))
  );
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);
  const [showImportPanel, setShowImportPanel] = useState(false);

  const [showInactive, setShowInactive] = useState(false);
  const [statusChangingId, setStatusChangingId] = useState<number | null>(null);
  const [confirmingDeactivateId, setConfirmingDeactivateId] = useState<number | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  async function loadProducts(includeInactive = showInactive) {
    const res = await api.get<Product[]>("/products", { params: includeInactive ? { includeInactive: "true" } : {} });
    setProducts(res.data);
  }

  useEffect(() => {
    loadProducts();
    api.get<Warehouse[]>("/warehouses").then((res) => setWarehouses(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defaultStockWarehouse = warehouses.find((w) => w.name === "Warehouse") ?? warehouses[0];
  const existingBarcodes = new Set(products.map((p) => p.barcode));
  const existingSkus = new Set(products.map((p) => p.sku));

  function applyTotalToSingleForm(value: string) {
    setStockTotal(value);
    if (stockAutoFilled && defaultStockWarehouse) {
      setStockAllocations((prev) => ({ ...prev, [defaultStockWarehouse.id]: value }));
    }
  }

  function updateSingleFormAllocation(warehouseId: number, value: string) {
    setStockAutoFilled(false);
    setStockAllocations((prev) => ({ ...prev, [warehouseId]: value }));
  }

  const stockAllocated = warehouses.reduce((sum, w) => sum + (Number(stockAllocations[w.id]) || 0), 0);
  const stockTotalNum = Number(stockTotal) || 0;
  const stockRemaining = stockTotalNum - stockAllocated;
  const stockSplitValid = stockTotalNum === 0 || stockRemaining === 0;

  useEffect(() => {
    loadProducts(showInactive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  async function deactivateProduct(id: number) {
    setStatusChangingId(id);
    setStatusError(null);
    try {
      await api.put(`/products/${id}`, { isActive: false });
      setConfirmingDeactivateId(null);
      loadProducts();
    } catch (err) {
      setStatusError(apiErrorMessage(err));
    } finally {
      setStatusChangingId(null);
    }
  }

  async function reactivateProduct(id: number) {
    setStatusChangingId(id);
    setStatusError(null);
    try {
      await api.put(`/products/${id}`, { isActive: true });
      loadProducts();
    } catch (err) {
      setStatusError(apiErrorMessage(err));
    } finally {
      setStatusChangingId(null);
    }
  }

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
      imageData: product.imageData ?? "",
    });
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetStockSplit() {
    setStockTotal("");
    setStockAllocations({});
    setStockAutoFilled(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    resetStockSplit();
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingId && !stockSplitValid) {
      setError("Initial stock split doesn't add up to the total — fix it before saving.");
      return;
    }
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
          imageData: form.imageData || undefined,
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
          imageData: form.imageData || undefined,
          initialStock: Object.entries(stockAllocations)
            .filter(([, qty]) => qty.trim() !== "" && Number(qty) > 0)
            .map(([warehouseId, qty]) => ({
              warehouseId: Number(warehouseId),
              quantity: Number(qty),
              reorderLevel: 0,
            })),
        });
        setSuccess(`Product "${form.name}" created.`);
        setForm(emptyForm);
        resetStockSplit();
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

  function updateBulkRowTotal(id: number, value: string) {
    setBulkRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated: BulkRow = { ...r, stockTotal: value, error: undefined };
        if (r.stockAutoFilled && defaultStockWarehouse) {
          updated.stockAllocations = { ...updated.stockAllocations, [defaultStockWarehouse.id]: value };
        }
        return updated;
      })
    );
  }

  function updateBulkRowAllocation(id: number, warehouseId: number, value: string) {
    setBulkRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, stockAutoFilled: false, stockAllocations: { ...r.stockAllocations, [warehouseId]: value }, error: undefined }
          : r
      )
    );
  }

  function bulkRowAllocated(row: BulkRow): number {
    return warehouses.reduce((sum, w) => sum + (Number(row.stockAllocations[w.id]) || 0), 0);
  }

  function bulkRowRemaining(row: BulkRow): number {
    return (Number(row.stockTotal) || 0) - bulkRowAllocated(row);
  }

  function removeBulkRow(id: number) {
    setBulkRows((prev) => prev.filter((r) => r.id !== id));
  }

  // Turns confirmed import rows into the exact same BulkRow shape a manually
  // typed row would have — from here on they're indistinguishable from
  // hand-entered rows: same edit controls, same validation, same "Save all".
  // Nothing is sent to the server here.
  function handleImportConfirm(rows: MappedImportRow[]) {
    const imported: BulkRow[] = rows.map((row) => {
      const stockTotal = row.stockTotal.trim();
      return {
        id: nextBulkRowId(),
        name: row.name,
        sku: row.sku,
        barcode: row.barcode,
        category: row.category,
        brand: row.brand,
        mrp: row.mrp,
        sellingPrice: row.sellingPrice,
        taxPercent: row.taxPercent.trim() || "0",
        unit: row.unit.trim() || "pcs",
        imageUrl: row.imageUrl,
        imageData: "",
        stockTotal,
        stockAllocations: stockTotal && defaultStockWarehouse ? { [defaultStockWarehouse.id]: stockTotal } : {},
        stockAutoFilled: true,
        error: row.errors.length > 0 ? row.errors.join("; ") : undefined,
      };
    });

    setBulkRows((prev) => {
      const kept = prev.filter((r) => r.name.trim() || r.barcode.trim());
      return [...kept, ...imported];
    });
    setShowImportPanel(false);
  }

  async function handleBulkSubmit() {
    setBulkSummary(null);

    // Rows with nothing filled in at all are just unused blanks — skip them silently.
    const isBlank = (r: BulkRow) => !r.name.trim() && !r.barcode.trim();
    const submittable = bulkRows.filter((r) => !isBlank(r));

    // Rows missing a required field, or with a stock split that doesn't add up, never leave the browser.
    const locallyInvalid = new Map<number, string>();
    for (const r of submittable) {
      if (!r.name.trim() || !r.barcode.trim() || !r.mrp.trim() || !r.sellingPrice.trim()) {
        locallyInvalid.set(r.id, "Name, barcode, MRP and price are required");
      } else if (Number(r.stockTotal) > 0 && bulkRowRemaining(r) !== 0) {
        locallyInvalid.set(r.id, "Stock split doesn't add up to the total");
      }
    }
    if (locallyInvalid.size > 0) {
      setBulkRows((prev) => prev.map((r) => (locallyInvalid.has(r.id) ? { ...r, error: locallyInvalid.get(r.id) } : r)));
    }

    const toSend = submittable.filter((r) => !locallyInvalid.has(r.id));
    if (toSend.length === 0) return;

    setBulkSubmitting(true);
    try {
      const res = await api.post<{
        results: Array<{ index: number; success: true } | { index: number; success: false; error: string }>;
      }>("/products/bulk", {
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
          imageUrl: r.imageUrl || undefined,
          imageData: r.imageData || undefined,
          initialStock: Object.entries(r.stockAllocations)
            .filter(([, qty]) => qty && Number(qty) > 0)
            .map(([warehouseId, qty]) => ({ warehouseId: Number(warehouseId), quantity: Number(qty) })),
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
        </div>

        <h4>Product image</h4>
        <ProductImageInput
          imageUrl={form.imageUrl}
          imageData={form.imageData}
          onChangeUrl={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
          onChangeData={(data) => setForm((f) => ({ ...f, imageData: data }))}
        />

        {!editingId && (
          <>
            <h4>Initial stock</h4>
            <div className="form-grid">
              <label>
                Total quantity
                <input
                  type="number"
                  min={0}
                  value={stockTotal}
                  onChange={(e) => applyTotalToSingleForm(e.target.value)}
                />
              </label>
            </div>

            {stockTotalNum > 0 && (
              <>
                <p className="help-text">
                  Defaults entirely to <strong>{defaultStockWarehouse?.name ?? "Warehouse"}</strong> — adjust below
                  only if this stock needs to be split across locations.
                </p>
                <div className="form-grid">
                  {warehouses.map((w) => (
                    <label key={w.id}>
                      {w.name}
                      <input
                        type="number"
                        min={0}
                        value={stockAllocations[w.id] ?? ""}
                        onChange={(e) => updateSingleFormAllocation(w.id, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
                <p className={stockRemaining === 0 ? "success-text" : "error-text"} style={{ marginTop: 8 }}>
                  {stockRemaining === 0 ? (
                    <>
                      <CheckCircle2 size={14} /> Balanced — {stockTotalNum} total
                    </>
                  ) : stockRemaining > 0 ? (
                    <>
                      <TriangleAlert size={14} /> {stockRemaining} not yet allocated
                    </>
                  ) : (
                    <>
                      <TriangleAlert size={14} /> Over-allocated by {-stockRemaining}
                    </>
                  )}
                </p>
              </>
            )}
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
          <button type="submit" className="primary" disabled={submitting || (!editingId && !stockSplitValid)}>
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
        <div className="section-header">
          <h3 style={{ marginBottom: 0 }}>
            <Layers size={16} /> Bulk add products
          </h3>
          {!showImportPanel && (
            <button type="button" className="link-button" onClick={() => setShowImportPanel(true)}>
              <FileSpreadsheet size={14} /> Import from Excel/CSV
            </button>
          )}
        </div>
        <p className="help-text">
          Add several products at once — fill in as many rows as you need. Leave <strong>SKU</strong> blank to
          auto-generate one. For stock, just fill <strong>Total</strong> — it defaults entirely to{" "}
          <strong>{defaultStockWarehouse?.name ?? "Warehouse"}</strong> unless you split it across the warehouse
          columns yourself. Rows that fail (e.g. duplicate barcode) stay in the table with the reason shown, so you
          only need to fix and resubmit those.
        </p>

        {showImportPanel && (
          <BulkImportPanel
            existingBarcodes={existingBarcodes}
            existingSkus={existingSkus}
            onConfirm={handleImportConfirm}
            onClose={() => setShowImportPanel(false)}
          />
        )}

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
                <th>Image</th>
                <th>Total stock</th>
                {warehouses.map((w) => (
                  <th key={w.id}>{w.name}</th>
                ))}
                <th>Remaining</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bulkRows.map((row) => {
                const remaining = bulkRowRemaining(row);
                const total = Number(row.stockTotal) || 0;
                return (
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
                      <ProductImageInput
                        compact
                        imageUrl={row.imageUrl}
                        imageData={row.imageData}
                        onChangeUrl={(url) => updateBulkRow(row.id, { imageUrl: url })}
                        onChangeData={(data) => updateBulkRow(row.id, { imageData: data })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        className="qty-input"
                        value={row.stockTotal}
                        onChange={(e) => updateBulkRowTotal(row.id, e.target.value)}
                      />
                    </td>
                    {warehouses.map((w) => (
                      <td key={w.id}>
                        <input
                          type="number"
                          min={0}
                          className="qty-input"
                          value={row.stockAllocations[w.id] ?? ""}
                          onChange={(e) => updateBulkRowAllocation(row.id, w.id, e.target.value)}
                        />
                      </td>
                    ))}
                    <td>
                      {total === 0 ? (
                        <span className="muted small">—</span>
                      ) : remaining === 0 ? (
                        <span className="discount-badge">balanced</span>
                      ) : remaining > 0 ? (
                        <span className="low-stock-badge">{remaining} left</span>
                      ) : (
                        <span className="out-of-stock-badge">over by {-remaining}</span>
                      )}
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
                );
              })}
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

      <div className="section-header" style={{ marginBottom: 8 }}>
        <h3 style={{ marginBottom: 0 }}>Existing products</h3>
        <label className="inline-checkbox">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive products
        </label>
      </div>

      {statusError && (
        <p className="error-text">
          <TriangleAlert size={14} /> {statusError}
        </p>
      )}

      <table className="cart-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>SKU</th>
            <th>Barcode</th>
            <th>MRP</th>
            <th>Price</th>
            <th>Tax %</th>
            {showInactive && <th>Status</th>}
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
                {showInactive && (
                  <td>
                    {p.isActive === false ? (
                      <span className="out-of-stock-badge">inactive</span>
                    ) : (
                      <span className="discount-badge">active</span>
                    )}
                  </td>
                )}
                <td className="row-actions">
                  {confirmingDeactivateId === p.id ? (
                    <span className="inline-confirm">
                      Deactivate?
                      <button
                        type="button"
                        className="link-button danger-link"
                        disabled={statusChangingId === p.id}
                        onClick={() => deactivateProduct(p.id)}
                      >
                        Yes
                      </button>
                      <button type="button" className="link-button" onClick={() => setConfirmingDeactivateId(null)}>
                        No
                      </button>
                    </span>
                  ) : (
                    <>
                      <button type="button" className="link-button" onClick={() => startEdit(p)}>
                        <Pencil size={13} /> Edit
                      </button>
                      {p.isActive === false ? (
                        <button
                          type="button"
                          className="link-button"
                          disabled={statusChangingId === p.id}
                          onClick={() => reactivateProduct(p.id)}
                        >
                          <RotateCcw size={13} /> Reactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="link-button danger-link"
                          onClick={() => setConfirmingDeactivateId(p.id)}
                        >
                          <Ban size={13} /> Deactivate
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
              {expandedProductId === p.id && (
                <tr>
                  <td colSpan={showInactive ? 8 : 7} className="stock-expand-cell">
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
