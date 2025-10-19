import { MODEL_BASE_URL } from "../config.ts";
import { HttpError } from "../errors.ts";

async function fetchJsonWithStatus(url: string, init?: RequestInit) {
  try {
    const response = await fetch(url, init);
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return { status: response.status, data };
  } catch (error) {
    console.error("Model service request failed", error);
    throw new HttpError(502, "Model service unavailable");
  }
}

export async function checkModelHealth() {
  try {
    const r = await fetch(`${MODEL_BASE_URL}/`);
    return { ok: true, status: r.status };
  } catch (err) {
    console.error("Model health check failed", err);
    throw new HttpError(502, String(err));
  }
}

export async function checkPhoto(dataUrl?: string) {
  if (!dataUrl) {
    throw new HttpError(400, "dataUrl is required");
  }
  const { status, data } = await fetchJsonWithStatus(
    `${MODEL_BASE_URL}/api/check_photo_json`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    }
  );

  return { status, data };
}

export async function loadDataset(dataset: "yaleface" | "lfw") {
  const endpoint = dataset === "yaleface" ? "load_yaleface" : "load_lfw";
  const { status, data } = await fetchJsonWithStatus(
    `${MODEL_BASE_URL}/api/${endpoint}`,
    { method: "POST" }
  );
  return { status, data };
}

export async function deleteDataset() {
  const { status, data } = await fetchJsonWithStatus(
    `${MODEL_BASE_URL}/api/delete_db`,
    { method: "POST" }
  );
  return { status, data };
}
