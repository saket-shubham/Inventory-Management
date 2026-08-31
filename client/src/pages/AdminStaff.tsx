import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Ban, CheckCircle2, Pencil, RotateCcw, TriangleAlert, UserPlus, Users, X } from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { StaffUser } from "../types";

const emptyCreateForm = { name: "", email: "", password: "" };

interface EditForm {
  name: string;
  email: string;
  role: "admin" | "staff";
  password: string;
}

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function AdminStaff() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", email: "", role: "staff", password: "" });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [statusChangingId, setStatusChangingId] = useState<number | null>(null);
  const [confirmingDeactivateId, setConfirmingDeactivateId] = useState<number | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  async function loadUsers() {
    const res = await api.get<StaffUser[]>("/users");
    setUsers(res.data);
  }

  useEffect(() => {
    loadUsers().finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setCreating(true);
    try {
      await api.post("/users", createForm);
      setCreateSuccess(`Staff account "${createForm.name}" created.`);
      setCreateForm(emptyCreateForm);
      loadUsers();
    } catch (err) {
      setCreateError(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(u: StaffUser) {
    setEditingId(u.id);
    setEditForm({ name: u.name, email: u.email, role: u.role, password: "" });
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (editingId === null) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      await api.put(`/users/${editingId}`, {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        ...(editForm.password.trim() ? { password: editForm.password } : {}),
      });
      setEditingId(null);
      loadUsers();
    } catch (err) {
      setEditError(apiErrorMessage(err));
    } finally {
      setEditSubmitting(false);
    }
  }

  async function deactivateUser(id: number) {
    setStatusChangingId(id);
    setStatusError(null);
    try {
      await api.put(`/users/${id}`, { isActive: false });
      setConfirmingDeactivateId(null);
      loadUsers();
    } catch (err) {
      setStatusError(apiErrorMessage(err));
    } finally {
      setStatusChangingId(null);
    }
  }

  async function reactivateUser(id: number) {
    setStatusChangingId(id);
    setStatusError(null);
    try {
      await api.put(`/users/${id}`, { isActive: true });
      loadUsers();
    } catch (err) {
      setStatusError(apiErrorMessage(err));
    } finally {
      setStatusChangingId(null);
    }
  }

  if (loading) return <div className="page-loading">Loading staff...</div>;

  return (
    <div className="admin-page">
      <h2>
        <Users size={19} /> Staff Management
      </h2>

      <form className="admin-form" onSubmit={handleCreate}>
        <h3>
          <UserPlus size={16} /> Add new staff
        </h3>
        <div className="form-grid">
          <label>
            Name
            <input
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              required
            />
          </label>
          <label>
            Temporary password
            <input
              type="text"
              minLength={6}
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              required
            />
          </label>
        </div>
        <p className="help-text">
          New accounts are created with role <strong>Staff</strong> and are active immediately. Share the temporary
          password with them directly — it isn't emailed automatically.
        </p>
        {createError && (
          <p className="error-text">
            <TriangleAlert size={14} /> {createError}
          </p>
        )}
        {createSuccess && (
          <p className="success-text">
            <CheckCircle2 size={14} /> {createSuccess}
          </p>
        )}
        <button type="submit" className="primary" disabled={creating}>
          {creating ? "Creating..." : "Create staff account"}
        </button>
      </form>

      {editingId !== null && (
        <form className="admin-form" onSubmit={submitEdit}>
          <h3>
            <Pencil size={16} /> Edit staff
          </h3>
          <div className="form-grid">
            <label>
              Name
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </label>
            <label>
              Email
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
              />
            </label>
            <label>
              Role
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as "admin" | "staff" })}
                disabled={editingId === currentUser?.id}
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label>
              New password (optional)
              <input
                type="text"
                minLength={6}
                placeholder="Leave blank to keep current password"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              />
            </label>
          </div>
          {editError && (
            <p className="error-text">
              <TriangleAlert size={14} /> {editError}
            </p>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" className="primary" disabled={editSubmitting}>
              {editSubmitting ? "Saving..." : "Save changes"}
            </button>
            <button type="button" className="link-button" onClick={cancelEdit}>
              <X size={14} /> Cancel
            </button>
          </div>
        </form>
      )}

      <h3>All Staff</h3>
      {statusError && (
        <p className="error-text">
          <TriangleAlert size={14} /> {statusError}
        </p>
      )}
      <table className="cart-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>User ID</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Created</th>
            <th>Last login</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <Link to={`/admin/staff/${u.id}`} className="inline-link">
                  {u.name}
                </Link>
              </td>
              <td>{u.id}</td>
              <td>{u.email}</td>
              <td>{u.role === "admin" ? "Admin" : "Staff"}</td>
              <td>
                {u.isActive ? (
                  <span className="discount-badge">active</span>
                ) : (
                  <span className="out-of-stock-badge">inactive</span>
                )}
              </td>
              <td>{new Date(u.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</td>
              <td>{formatDateTime(u.lastLoginAt)}</td>
              <td className="row-actions">
                {confirmingDeactivateId === u.id ? (
                  <span className="inline-confirm">
                    Deactivate?
                    <button
                      type="button"
                      className="link-button danger-link"
                      disabled={statusChangingId === u.id}
                      onClick={() => deactivateUser(u.id)}
                    >
                      Yes
                    </button>
                    <button type="button" className="link-button" onClick={() => setConfirmingDeactivateId(null)}>
                      No
                    </button>
                  </span>
                ) : (
                  <>
                    <button type="button" className="link-button" onClick={() => startEdit(u)}>
                      <Pencil size={13} /> Edit
                    </button>
                    {u.id === currentUser?.id ? null : u.isActive ? (
                      <button
                        type="button"
                        className="link-button danger-link"
                        onClick={() => setConfirmingDeactivateId(u.id)}
                      >
                        <Ban size={13} /> Deactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="link-button"
                        disabled={statusChangingId === u.id}
                        onClick={() => reactivateUser(u.id)}
                      >
                        <RotateCcw size={13} /> Reactivate
                      </button>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={8} className="muted">
                No staff accounts yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
