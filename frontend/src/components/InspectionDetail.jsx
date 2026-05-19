import { useState, useEffect } from "react";
import { getInspection } from "../api";

const s = {
  backBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#a0522d",
    fontWeight: 600,
    fontSize: 14,
    marginBottom: 20,
    padding: 0,
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: 32,
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    maxWidth: 600,
  },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 8 },
  badge: { display: "inline-block", borderRadius: 999, padding: "4px 12px", fontSize: 13, fontWeight: 600, marginBottom: 20 },
  row: { display: "flex", gap: 8, marginBottom: 10, fontSize: 14 },
  label: { color: "#6b7280", minWidth: 110, fontWeight: 600 },
  value: { color: "#1a1a2e" },
  desc: {
    marginTop: 20,
    padding: 16,
    background: "#f9fafb",
    borderRadius: 8,
    fontSize: 14,
    color: "#374151",
    lineHeight: 1.6,
  },
};

function StatusBadge({ status }) {
  const colors = {
    pending:   { background: "#fef3c7", color: "#92400e" },
    processed: { background: "#d1fae5", color: "#065f46" },
  };
  return (
    <span style={{ ...s.badge, ...(colors[status] || { background: "#f3f4f6", color: "#374151" }) }}>
      {status === "processed" ? "✓ processed" : "⏳ pending"}
    </span>
  );
}

export default function InspectionDetail({ id, onBack }) {
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  useEffect(() => {
    getInspection(id)
      .then(setInspection)
      .catch(() => setError("Could not load inspection."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p style={{ color: "#6b7280", marginTop: 40 }}>Loading...</p>;
  if (error)   return <p style={{ color: "#dc2626", marginTop: 40 }}>{error}</p>;

  return (
    <>
      <button style={s.backBtn} onClick={onBack}>← Back to list</button>
      <div style={s.card}>
        <p style={s.title}>{inspection.title}</p>
        <StatusBadge status={inspection.status} />

        <div style={s.row}>
          <span style={s.label}>Book ID</span>
          <span style={{ ...s.value, fontFamily: "monospace", fontSize: 12 }}>{inspection.id}</span>
        </div>
        <div style={s.row}>
          <span style={s.label}>Created</span>
          <span style={s.value}>{new Date(inspection.createdAt).toLocaleString()}</span>
        </div>
        {inspection.processedAt && (
          <div style={s.row}>
            <span style={s.label}>Processed</span>
            <span style={s.value}>{new Date(inspection.processedAt).toLocaleString()}</span>
          </div>
        )}

        {inspection.description && (
          <div style={s.desc}>{inspection.description}</div>
        )}
      </div>
    </>
  );
}
