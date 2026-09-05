import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, History, User } from "lucide-react";
import { api } from "../api/client";
import { auditActionLabel, auditDetails } from "../utils/auditLog";
import type { AuditLog, StaffUser } from "../types";

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function AdminStaffDetail() {
  const { id } = useParams();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [activity, setActivity] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ user: StaffUser; activity: AuditLog[] }>(`/users/${id}`)
      .then((res) => {
        setUser(res.data.user);
        setActivity(res.data.activity);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-loading">Loading staff details...</div>;
  if (!user) return <div className="admin-page">Staff account not found.</div>;

  return (
    <div className="admin-page">
      <Link to="/admin/staff" className="inline-link small">
        <ArrowLeft size={13} /> Back to Staff Management
      </Link>

      <h2>
        <User size={19} /> {user.name}
      </h2>

      <div className="admin-form">
        <div className="form-grid">
          <div>
            <span className="muted small">User ID</span>
            <p style={{ margin: "2px 0 0", fontWeight: 700 }}>{user.id}</p>
          </div>
          <div>
            <span className="muted small">Email</span>
            <p style={{ margin: "2px 0 0", fontWeight: 700 }}>{user.email}</p>
          </div>
          <div>
            <span className="muted small">Role</span>
            <p style={{ margin: "2px 0 0", fontWeight: 700 }}>{user.role === "admin" ? "Admin" : "Staff"}</p>
          </div>
          <div>
            <span className="muted small">Status</span>
            <p style={{ margin: "2px 0 0" }}>
              {user.isActive ? (
                <span className="discount-badge">active</span>
              ) : (
                <span className="out-of-stock-badge">inactive</span>
              )}
            </p>
          </div>
          <div>
            <span className="muted small">Created</span>
            <p style={{ margin: "2px 0 0", fontWeight: 700 }}>
              {new Date(user.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
            </p>
          </div>
          <div>
            <span className="muted small">Last login</span>
            <p style={{ margin: "2px 0 0", fontWeight: 700 }}>{formatDateTime(user.lastLoginAt)}</p>
          </div>
        </div>
      </div>

      <h3>
        <History size={16} /> Activity
      </h3>
      <table className="cart-table">
        <thead>
          <tr>
            <th>Date/time</th>
            <th>Action</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {activity.length === 0 && (
            <tr>
              <td colSpan={3} className="muted">
                No recorded activity yet.
              </td>
            </tr>
          )}
          {activity.map((log) => (
            <tr key={log.id}>
              <td>{formatDateTime(log.createdAt)}</td>
              <td>{auditActionLabel(log.action)}</td>
              <td>{auditDetails(log)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
