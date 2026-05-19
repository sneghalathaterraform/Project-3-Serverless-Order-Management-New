const s = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  heading: { fontSize: 22, fontWeight: 700 },
  refreshBtn: {
    background: "transparent",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: 13,
    color: "#374151",
  },
  empty: {
    background: "#fff",
    borderRadius: 12,
    padding: 48,
    textAlign: "center",
    color: "#6b7280",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 16,
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
    cursor: "pointer",
    border: "2px solid transparent",
    transition: "border-color 0.15s",
  },
  cardTitle: { fontWeight: 700, fontSize: 16, marginBottom: 6 },
  cardDesc: { fontSize: 13, color: "#6b7280", marginBottom: 14, minHeight: 36 },
  badge: { display: "inline-block", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 },
  date: { fontSize: 11, color: "#9ca3af", marginTop: 10 },
};

function StatusBadge({ status }) {
  const colors = {
    pending:   { background: "#fef3c7", color: "#92400e" },
    processed: { background: "#d1fae5", color: "#065f46" },
  };
  return (
    <span style={{ ...s.badge, ...(colors[status] || { background: "#f3f4f6", color: "#374151" }) }}>
      {status}
    </span>
  );
}

export default function InspectionList({ inspections, loading, onSelect, onRefresh }) {
  if (loading) {
    return <p style={{ textAlign: "center", color: "#6b7280", marginTop: 60 }}>Loading...</p>;
  }

  return (
    <>
      <div style={s.header}>
        <p style={s.heading}>📚 Book Catalog ({inspections.length})</p>
        <button style={s.refreshBtn} onClick={onRefresh}>↻ Refresh</button>
      </div>

      {inspections.length === 0 ? (
        <div style={s.empty}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>📚</p>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>No books yet</p>
          <p style={{ fontSize: 13 }}>Click "+ Add New Book" to get started</p>
        </div>
      ) : (
        <div style={s.grid}>
          {inspections.map(item => (
            <div
              key={item.id}
              style={s.card}
              onClick={() => onSelect(item.id)}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#a0522d"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}
            >
              <p style={s.cardTitle}>{item.title}</p>
              <p style={s.cardDesc}>{item.description || "No description"}</p>
              <StatusBadge status={item.status} />
              <p style={s.date}>{new Date(item.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
