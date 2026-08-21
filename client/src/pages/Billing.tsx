import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, ScanLine, ShoppingCart, TriangleAlert } from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import { useCart } from "../context/CartContext";
import { ScanInput } from "../components/ScanInput";
import { CameraScanner } from "../components/CameraScanner";
import { ProductLookupCard } from "../components/ProductLookupCard";
import { CartTable } from "../components/CartTable";
import type { Customer, PaymentMode, Product, Warehouse } from "../types";

export function Billing() {
  const navigate = useNavigate();
  const cart = useCart();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerMode, setNewCustomerMode] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [discount, setDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/warehouses").then((res) => {
      setWarehouses(res.data);
      if (res.data.length > 0 && cart.warehouseId === null) {
        cart.setWarehouseId(res.data[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (!customerSearch.trim()) {
        setCustomerResults([]);
        return;
      }
      api.get("/customers", { params: { search: customerSearch } }).then((res) => setCustomerResults(res.data));
    }, 250);
    return () => clearTimeout(handle);
  }, [customerSearch]);

  async function handleScan(barcode: string) {
    setLookupError(null);
    setScannedProduct(null);
    try {
      const res = await api.get<Product>("/products/lookup", { params: { barcode } });
      setScannedProduct(res.data);
    } catch (err) {
      setLookupError(apiErrorMessage(err));
    }
  }

  function handleAddToCart() {
    if (!scannedProduct) return;
    const billingStock = scannedProduct.stockByWarehouse?.find((s) => s.warehouseId === cart.warehouseId);
    cart.addItem(scannedProduct, scannedProduct.barcode, billingStock?.quantity ?? 0);
    setScannedProduct(null);
  }

  async function createNewCustomer() {
    const res = await api.post<Customer>("/customers", { name: newCustomerName, phone: newCustomerPhone });
    setSelectedCustomer(res.data);
    setNewCustomerMode(false);
    setCustomerSearch("");
    setCustomerResults([]);
  }

  async function handleGenerateInvoice() {
    if (!cart.warehouseId || cart.lines.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.post("/invoices", {
        warehouseId: cart.warehouseId,
        customerId: selectedCustomer?.id,
        paymentMode,
        discount,
        items: cart.lines.map((l) => ({
          productId: l.product.id,
          qty: l.qty,
          discount: l.discount,
          barcodeScanned: l.barcodeScanned,
        })),
      });
      cart.clear();
      setSelectedCustomer(null);
      setDiscount(0);
      navigate(`/invoices/${res.data.id}`);
    } catch (err) {
      setSubmitError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const grandTotal = cart.grandTotal(discount);

  return (
    <div className="billing-page">
      <section className="scan-section">
        <div className="section-header">
          <h2>
            <ScanLine size={19} /> Scan &amp; Lookup
          </h2>
          <label className="warehouse-select">
            Billing counter
            <select
              value={cart.warehouseId ?? ""}
              onChange={(e) => cart.setWarehouseId(Number(e.target.value))}
              disabled={cart.lines.length > 0}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ScanInput onScan={handleScan} />

        <button type="button" className="link-button" onClick={() => setShowCamera((v) => !v)}>
          <Camera size={13} /> {showCamera ? "Hide camera scanner" : "Use phone camera instead"}
        </button>
        {showCamera && <CameraScanner onScan={handleScan} />}

        {lookupError && (
          <p className="error-text">
            <TriangleAlert size={14} /> {lookupError}
          </p>
        )}
        {scannedProduct && (
          <ProductLookupCard
            product={scannedProduct}
            billingWarehouseId={cart.warehouseId}
            onAddToCart={handleAddToCart}
          />
        )}
      </section>

      <section className="cart-section">
        <h2>
          <ShoppingCart size={19} /> Cart
        </h2>
        <CartTable />

        <div className="customer-picker">
          <h3>Customer (optional)</h3>
          {selectedCustomer ? (
            <div className="selected-customer">
              {selectedCustomer.name} {selectedCustomer.phone ? `(${selectedCustomer.phone})` : ""}
              <button type="button" className="link-button" onClick={() => setSelectedCustomer(null)}>
                Change
              </button>
            </div>
          ) : newCustomerMode ? (
            <div className="new-customer-form">
              <input
                placeholder="Name"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
              />
              <input
                placeholder="Phone"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
              />
              <button type="button" disabled={!newCustomerName.trim()} onClick={createNewCustomer}>
                Save customer
              </button>
              <button type="button" className="link-button" onClick={() => setNewCustomerMode(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <>
              <input
                placeholder="Search customer by name/phone"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
              {customerResults.length > 0 && (
                <ul className="customer-results">
                  {customerResults.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerSearch("");
                          setCustomerResults([]);
                        }}
                      >
                        {c.name} {c.phone ? `(${c.phone})` : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="link-button" onClick={() => setNewCustomerMode(true)}>
                + New customer
              </button>
            </>
          )}
        </div>

        <div className="invoice-totals">
          <div>
            <span>Subtotal</span>
            <span>₹{cart.subtotal.toFixed(2)}</span>
          </div>
          <div>
            <span>Tax</span>
            <span>₹{cart.taxAmount.toFixed(2)}</span>
          </div>
          <div>
            <span>Discount</span>
            <input
              type="number"
              min={0}
              value={discount}
              onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
              className="qty-input"
            />
          </div>
          <div className="grand-total">
            <span>Grand Total</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>

        <label className="payment-mode">
          Payment mode
          <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
          </select>
        </label>

        {submitError && <p className="error-text">{submitError}</p>}
        <button
          type="button"
          className="primary"
          disabled={cart.lines.length === 0 || submitting}
          onClick={handleGenerateInvoice}
        >
          {submitting ? "Generating..." : "Generate Invoice"}
        </button>
      </section>
    </div>
  );
}
