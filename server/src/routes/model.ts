import { Router } from "express";
import { MODEL_BASE_URL } from "../config.ts";

const router = Router();

router.get("/health", async (_req, res) => {
  try {
    const r = await fetch(`${MODEL_BASE_URL}/`);
    res.status(200).json({ ok: true, status: r.status });
  } catch (err: any) {
    res.status(502).json({ ok: false, error: String(err) });
  }
});

router.post("/check-photo", async (req, res) => {
  try {
    const { dataUrl } = req.body as { dataUrl?: string };
    if (!dataUrl) {
      return res.status(400).json({ error: "dataUrl is required" });
    }

    const r = await fetch(`${MODEL_BASE_URL}/api/check_photo_json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err: any) {
    res
      .status(502)
      .json({ error: "Model service unavailable", details: String(err) });
  }
});

router.post("/dataset/yaleface", async (_req, res) => {
  try {
    const r = await fetch(`${MODEL_BASE_URL}/api/load_yaleface`, {
      method: "POST",
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err: any) {
    res
      .status(502)
      .json({ error: "Model service unavailable", details: String(err) });
  }
});

router.post("/dataset/lfw", async (_req, res) => {
  try {
    const r = await fetch(`${MODEL_BASE_URL}/api/load_lfw`, { method: "POST" });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err: any) {
    res
      .status(502)
      .json({ error: "Model service unavailable", details: String(err) });
  }
});

router.post("/dataset/delete", async (_req, res) => {
  try {
    const r = await fetch(`${MODEL_BASE_URL}/api/delete_db`, {
      method: "POST",
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err: any) {
    res
      .status(502)
      .json({ error: "Model service unavailable", details: String(err) });
  }
});

export default router;
