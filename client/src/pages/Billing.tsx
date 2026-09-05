import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, CheckCircle2, Package, PauseCircle, ScanLine, ShoppingCart, Tag, TriangleAlert, X } from "lucide-react";
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
  const [newCustomerEmail, setNewCustomerEmail] = useState("");

  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [holding, setHolding] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);

  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercent: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);

  // Optional, manually entered flat charges — left blank unless the cashier
  // types something, never taxed/discounted, added straight onto the total.
  const [packagingChargeInput, setPackagingChargeInput] = useState("");
  const [transportChargeInput, setTransportChargeInput] = useState("");

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

  async function createNewCustomer(): Promise<Customer> {
    // Upserts by phone on the server — this is the Customer Database's entry
    // point, so an existing customer's record gets updated in place instead
    // of a duplicate being created.
    const res = await api.post<Customer>("/customers", {
      name: newCustomerName,
      phone: newCustomerPhone || undefined,
      email: newCustomerEmail || undefined,
    });
    setSelectedCustomer(res.data);
    setNewCustomerMode(false);
    setCustomerSearch("");
    setCustomerResults([]);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    return res.data;
  }

  // If the cashier typed a name/phone into the new-customer form but never
  // clicked "Save customer", generating the invoice/hold anyway shouldn't
  // silently throw that typed info away — save it now, right before billing.
  async function resolveCustomerId(): Promise<number | undefined> {
    if (selectedCustomer) return selectedCustomer.id;
    if (newCustomerMode && newCustomerName.trim()) {
      const created = await createNewCustomer();
      return created.id;
    }
    return undefined;
  }

  async function applyCoupon() {
    const code = couponCodeInput.trim();
    if (!code) return;
    setCouponChecking(true);
    setCouponError(null);
    try {
      const res = await api.get<{ code: string; discountPercent: string }>("/coupons/validate", {
        params: { code },
      });
      setAppliedCoupon({ code: res.data.code, discountPercent: Number(res.data.discountPercent) });
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(apiErrorMessage(err));
    } finally {
      setCouponChecking(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponCodeInput("");
    setCouponError(null);
  }

  const couponDiscountAmount = appliedCoupon ? (cart.subtotal * appliedCoupon.discountPercent) / 100 : 0;

  // Empty/invalid/negative all safely collapse to "not charged" — never lets
  // a bad value slip into the total.
  function parseCharge(input: string): number {
    const n = Number(input);
    return input.trim() !== "" && Number.isFinite(n) && n > 0 ? n : 0;
  }

  const packagingCharge = parseCharge(packagingChargeInput);
  const transportCharge = parseCharge(transportChargeInput);

  async function handleGenerateInvoice() {
    if (!cart.warehouseId || cart.lines.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const customerId = await resolveCustomerId();
      const res = await api.post("/invoices", {
        warehouseId: cart.warehouseId,
        customerId,
        paymentMode,
        ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
        packagingCharge,
        transportCharge,
        items: cart.lines.map((l) => ({
          productId: l.product.id,
          qty: l.qty,
          discount: l.discount,
          barcodeScanned: l.barcodeScanned,
        })),
      });
      cart.clear();
      setSelectedCustomer(null);
      removeCoupon();
      setPackagingChargeInput("");
      setTransportChargeInput("");
      navigate(`/invoices/${res.data.id}`);
    } catch (err) {
      setSubmitError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleHold() {
    if (!cart.warehouseId || cart.lines.length === 0) return;
    setHolding(true);
    setHoldError(null);
    try {
      const customerId = await resolveCustomerId();
      const res = await api.post("/hold-invoices", {
        warehouseId: cart.warehouseId,
        customerId,
        items: cart.lines.map((l) => ({ productId: l.product.id, qty: l.qty })),
      });
      cart.clear();
      setSelectedCustomer(null);
      removeCoupon();
      navigate(`/hold/${res.data.id}`);
    } catch (err) {
      setHoldError(apiErrorMessage(err));
    } finally {
      setHolding(false);
    }
  }

  const grandTotal = cart.grandTotal(couponDiscountAmount) + packagingCharge + transportCharge;

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
                placeholder="Phone (WhatsApp)"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
              />
              <input
                type="email"
                placeholder="Email (optional)"
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
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

        <div className="coupon-section">
          <h3>
            <Tag size={14} /> Coupon code
          </h3>
          {appliedCoupon ? (
            <span className="coupon-applied">
              <CheckCircle2 size={14} /> {appliedCoupon.code} — {appliedCoupon.discountPercent}% (−₹
              {couponDiscountAmount.toFixed(2)})
              <button type="button" className="link-button" onClick={removeCoupon}>
                <X size={13} /> Remove
              </button>
            </span>
          ) : (
            <span className="coupon-input-group">
              <input
                placeholder="e.g. DISCOUNT10"
                value={couponCodeInput}
                onChange={(e) => setCouponCodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCoupon();
                  }
                }}
              />
              <button type="button" disabled={!couponCodeInput.trim() || couponChecking} onClick={applyCoupon}>
                {couponChecking ? "Checking..." : "Apply"}
              </button>
            </span>
          )}
          {couponError && (
            <p className="error-text">
              <TriangleAlert size={14} /> {couponError}
            </p>
          )}
        </div>

        <div className="charges-section">
          <h3>
            <Package size={14} /> Additional charges (optional)
          </h3>
          <div className="charges-inputs">
            <label>
              Packaging Charges
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={packagingChargeInput}
                onChange={(e) => setPackagingChargeInput(e.target.value)}
              />
            </label>
            <label>
              Transport Charges
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={transportChargeInput}
                onChange={(e) => setTransportChargeInput(e.target.value)}
              />
            </label>
          </div>
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
          {appliedCoupon && (
            <div>
              <span>Coupon ({appliedCoupon.code})</span>
              <span>−₹{couponDiscountAmount.toFixed(2)}</span>
            </div>
          )}
          {packagingCharge > 0 && (
            <div>
              <span>Packaging Charges</span>
              <span>₹{packagingCharge.toFixed(2)}</span>
            </div>
          )}
          {transportCharge > 0 && (
            <div>
              <span>Transport Charges</span>
              <span>₹{transportCharge.toFixed(2)}</span>
            </div>
          )}
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
        {holdError && (
          <p className="error-text">
            <TriangleAlert size={14} /> {holdError}
          </p>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="primary"
            disabled={cart.lines.length === 0 || submitting || holding}
            onClick={handleGenerateInvoice}
          >
            {submitting ? "Generating..." : "Generate Invoice"}
          </button>
          <button
            type="button"
            className="hold-button"
            disabled={cart.lines.length === 0 || submitting || holding}
            onClick={handleHold}
            title="Move these items to Hold instead of billing them now"
          >
            <PauseCircle size={15} /> {holding ? "Holding..." : "Hold"}
          </button>
        </div>
      </section>
    </div>
  );
}
