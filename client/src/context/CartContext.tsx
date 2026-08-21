import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CartLine, Product } from "../types";

interface CartContextValue {
  warehouseId: number | null;
  setWarehouseId: (id: number | null) => void;
  lines: CartLine[];
  addItem: (product: Product, barcodeScanned: string, availableAtBillingWarehouse: number) => void;
  updateQty: (productId: number, qty: number) => void;
  updateDiscount: (productId: number, discount: number) => void;
  removeItem: (productId: number) => void;
  clear: () => void;
  subtotal: number;
  taxAmount: number;
  grandTotal: (discount: number) => number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

function discountedBase(line: CartLine): number {
  const lineBase = Number(line.product.sellingPrice) * line.qty;
  return Math.max(0, lineBase - Math.min(line.discount, lineBase));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [warehouseId, setWarehouseIdState] = useState<number | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);

  function setWarehouseId(id: number | null) {
    setWarehouseIdState(id);
    setLines([]);
  }

  function addItem(product: Product, barcodeScanned: string, availableAtBillingWarehouse: number) {
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        const nextQty = Math.min(existing.qty + 1, availableAtBillingWarehouse);
        return prev.map((l) => (l.product.id === product.id ? { ...l, qty: nextQty } : l));
      }
      return [...prev, { product, qty: 1, discount: 0, barcodeScanned, availableAtBillingWarehouse }];
    });
  }

  function updateQty(productId: number, qty: number) {
    setLines((prev) =>
      prev.map((l) =>
        l.product.id === productId
          ? { ...l, qty: Math.max(1, Math.min(qty, l.availableAtBillingWarehouse)) }
          : l
      )
    );
  }

  function updateDiscount(productId: number, discount: number) {
    setLines((prev) =>
      prev.map((l) => (l.product.id === productId ? { ...l, discount: Math.max(0, discount) } : l))
    );
  }

  function removeItem(productId: number) {
    setLines((prev) => prev.filter((l) => l.product.id !== productId));
  }

  function clear() {
    setLines([]);
  }

  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + discountedBase(l), 0), [lines]);

  const taxAmount = useMemo(
    () => lines.reduce((sum, l) => sum + (discountedBase(l) * Number(l.product.taxPercent)) / 100, 0),
    [lines]
  );

  function grandTotal(discount: number) {
    return Math.max(0, subtotal + taxAmount - discount);
  }

  return (
    <CartContext.Provider
      value={{
        warehouseId,
        setWarehouseId,
        lines,
        addItem,
        updateQty,
        updateDiscount,
        removeItem,
        clear,
        subtotal,
        taxAmount,
        grandTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
