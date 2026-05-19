const API = "https://api.cloudgrip.art/v1";

export async function createInspection(data) {
  const res = await fetch(`${API}/inspections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create inspection");
  return res.json();
}

export async function uploadPhoto(uploadUrl, file) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: file,
  });
  if (!res.ok) throw new Error("Failed to upload photo");
}

export async function listInspections() {
  const res = await fetch(`${API}/inspections`);
  if (!res.ok) throw new Error("Failed to load inspections");
  return res.json();
}

export async function getInspection(id) {
  const res = await fetch(`${API}/inspections/${id}`);
  if (!res.ok) throw new Error("Inspection not found");
  return res.json();
}
