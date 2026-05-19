import { useState, useEffect } from "react";
import InspectionForm from "./components/InspectionForm";
import InspectionList from "./components/InspectionList";
import InspectionDetail from "./components/InspectionDetail";
import { listInspections } from "./api";

const s = {
  header: {
    background: "#3b1f0a",
    color: "#f5e6d3",
    padding: "16px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "3px solid #a0522d",
  },
  logo: { fontSize: 22, fontWeight: 700, letterSpacing: 1, cursor: "pointer" },
  main: { maxWidth: 900, margin: "32px auto", padding: "0 16px" },
  newBtn: {
    background: "#a0522d",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 20px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  },
};

export default function App() {
  const [view, setView] = useState("list");   // list | create | detail
  const [selectedId, setSelectedId] = useState(null);
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await listInspections();
      setInspections(data.items || []);
    } catch {
      setInspections([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openDetail(id) {
    setSelectedId(id);
    setView("detail");
  }

  function afterCreate() {
    setView("list");
    load();
  }

  return (
    <>
      <header style={s.header}>
        <span style={s.logo} onClick={() => setView("list")} role="button" tabIndex={0}>
          📚 CloudGrip Library
        </span>
        {view !== "create" && (
          <button style={s.newBtn} onClick={() => setView("create")}>
            + Add New Book
          </button>
        )}
      </header>

      <main style={s.main}>
        {view === "list" && (
          <InspectionList
            inspections={inspections}
            loading={loading}
            onSelect={openDetail}
            onRefresh={load}
          />
        )}
        {view === "create" && (
          <InspectionForm
            onSuccess={afterCreate}
            onCancel={() => setView("list")}
          />
        )}
        {view === "detail" && (
          <InspectionDetail
            id={selectedId}
            onBack={() => setView("list")}
          />
        )}
      </main>
    </>
  );
}
