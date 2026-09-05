import { useEffect, useState } from "react";
import { Search, Users } from "lucide-react";
import { api } from "../api/client";
import type { Customer } from "../types";

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadCustomers() {
    setLoading(true);
    try {
      const res = await api.get<Customer[]>("/customers", { params: search ? { search } : {} });
      setCustomers(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handle = setTimeout(loadCustomers, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="invoice-history">
      <h2>
        <Users size={19} /> Customers
      </h2>

      <form className="filters" onSubmit={(e) => e.preventDefault()}>
        <label>
          Search
          <input
            placeholder="Name, phone, or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button type="button" onClick={loadCustomers}>
          <Search size={14} /> Search
        </button>
      </form>

      {loading ? (
        <p className="muted">Loading...</p>
      ) : (
        <table className="cart-table">
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>Name</th>
              <th>Phone / WhatsApp</th>
              <th>Email</th>
              <th>GST Number</th>
              <th>Address</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.name}</td>
                <td>{c.phone ?? <span className="muted small">—</span>}</td>
                <td>{c.email ?? <span className="muted small">—</span>}</td>
                <td>{c.gstNumber ?? <span className="muted small">—</span>}</td>
                <td>{c.address ?? <span className="muted small">—</span>}</td>
                <td>{c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—"}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
