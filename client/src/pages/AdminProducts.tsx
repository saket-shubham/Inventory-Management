import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Pencil, Package, PackagePlus, TriangleAlert, X } from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import type { Product, Warehouse } from "../types";

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

export function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [initialStock, setInitialStock] = useState<Record<number, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadProducts() {
    const res = await api.get<Product[]>("/products");
    setProducts(res.data);
  }

  useEffect(() => {
    loadProducts();
    api.get<Warehouse[]>("/warehouses").then((res) => setWarehouses(res.data));
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
            <tr key={p.id}>
              <td>{p.name}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
