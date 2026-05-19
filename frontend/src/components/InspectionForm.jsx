import { useState } from "react";
import { createInspection, uploadPhoto } from "../api";

const s = {
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: 32,
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    maxWidth: 560,
    margin: "0 auto",
  },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 24 },
  label: { display: "block", fontWeight: 600, marginBottom: 6, fontSize: 14 },
  input: {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    marginBottom: 18,
    outline: "none",
  },
  textarea: {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    marginBottom: 18,
    minHeight: 90,
    resize: "vertical",
    outline: "none",
  },
  fileBox: {
    border: "2px dashed #d1d5db",
    borderRadius: 8,
    padding: 20,
    textAlign: "center",
    marginBottom: 24,
    cursor: "pointer",
    fontSize: 14,
    color: "#6b7280",
  },
  row: { display: "flex", gap: 12 },
  submitBtn: {
    flex: 1,
    background: "#a0522d",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "12px 0",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 15,
  },
  cancelBtn: {
    flex: 1,
    background: "#f3f4f6",
    color: "#374151",
    border: "none",
    borderRadius: 8,
    padding: "12px 0",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 15,
  },
  status: { marginBottom: 16, padding: "10px 14px", borderRadius: 8, fontSize: 14 },
};

export default function InspectionForm({ onSuccess, onCancel }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [step, setStep] = useState("idle"); // idle | saving | uploading | done | error
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    setError("");

    try {
      // Step 1: Create the inspection record
      setStep("saving");
      const { id, uploadUrl } = await createInspection({ title, description });

      // Step 2: Upload photo if provided
      if (photo && uploadUrl) {
        setStep("uploading");
        await uploadPhoto(uploadUrl, photo);
      }

      setStep("done");
      setTimeout(onSuccess, 800);
    } catch (err) {
      setStep("error");
      setError(err.message);
    }
  }

  const stepMsg = {
    saving:    { bg: "#eff6ff", color: "#1d4ed8", text: "Saving inspection..." },
    uploading: { bg: "#eff6ff", color: "#1d4ed8", text: "Uploading photo..." },
    done:      { bg: "#f0fdf4", color: "#15803d", text: "Done! Redirecting..." },
    error:     { bg: "#fef2f2", color: "#dc2626", text: error },
  }[step];

  return (
    <div style={s.card}>
      <p style={s.title}>📖 Add New Book</p>

      {stepMsg && (
        <div style={{ ...s.status, background: stepMsg.bg, color: stepMsg.color }}>
          {stepMsg.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <label style={s.label}>Book Title *</label>
        <input
          style={s.input}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. The Great Gatsby"
          disabled={step === "saving" || step === "uploading"}
        />

        <label style={s.label}>Author / Summary</label>
        <textarea
          style={s.textarea}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Author name, genre, short summary..."
          disabled={step === "saving" || step === "uploading"}
        />

        <label style={s.label}>Cover Image (optional)</label>
        <div
          style={{
            ...s.fileBox,
            borderColor: photo ? "#a0522d" : "#d1d5db",
            color: photo ? "#a0522d" : "#6b7280",
          }}
          onClick={() => document.getElementById("photo-input").click()}
        >
          {photo ? `Selected: ${photo.name}` : "Click to select a cover image (JPG)"}
          <input
            id="photo-input"
            type="file"
            accept="image/jpeg"
            style={{ display: "none" }}
            onChange={e => setPhoto(e.target.files[0] || null)}
          />
        </div>

        <div style={s.row}>
          <button
            type="button"
            style={s.cancelBtn}
            onClick={onCancel}
            disabled={step === "saving" || step === "uploading"}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={s.submitBtn}
            disabled={step === "saving" || step === "uploading" || step === "done"}
          >
            {step === "saving" ? "Saving..." : step === "uploading" ? "Uploading..." : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}
