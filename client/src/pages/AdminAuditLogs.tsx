import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { api } from "../api/client";
import { AUDIT_ACTIONS, auditActionLabel, auditDetails } from "../utils/auditLog";
import type { AuditLog, StaffUser } from "../types";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await api.get<AuditLog[]>("/audit-logs", {
        params: {
          ...(userId ? { userId } : {}),
          ...(action ? { action } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      });
      setLogs(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.get<StaffUser[]>("/users").then((res) => setUsers(res.data));
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="admin-page">
      <h2>
        <ClipboardList size={19} /> Activity / Audit Logs
      </h2>

      <div className="filters">
        <label>
          User
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">All</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} (ID {u.id})
              </option>
            ))}
          </select>
        </label>
        <label>
          Action
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {auditActionLabel(a)}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="button" className="primary" onClick={loadLogs}>
          Apply filters
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading activity...</p>
      ) : (
        <table className="cart-table">
          <thead>
            <tr>
              <th>Date/time</th>
              <th>User</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No activity recorded for this filter.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{formatDateTime(log.createdAt)}</td>
                <td>
                  {log.user.name} <span className="muted small">(ID {log.userId})</span>
                </td>
                <td>{auditActionLabel(log.action)}</td>
                <td>{auditDetails(log)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
