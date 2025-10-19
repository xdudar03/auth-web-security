import { Router } from "express";
import {
  checkModelHealth,
  checkPhoto,
  deleteDataset,
  loadDataset,
} from "../services/model.ts";
import { HttpError } from "../errors.ts";

const router = Router();

router.get("/health", async (_req, res) => {
  try {
    const result = await checkModelHealth();
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/check-photo", async (req, res) => {
  try {
    const { dataUrl } = req.body as { dataUrl?: string };
    const { status, data } = await checkPhoto(dataUrl);
    res.status(status).json(data);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/dataset/yaleface", async (_req, res) => {
  try {
    const { status, data } = await loadDataset("yaleface");
    res.status(status).json(data);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/dataset/lfw", async (_req, res) => {
  try {
    const { status, data } = await loadDataset("lfw");
    res.status(status).json(data);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/dataset/delete", async (_req, res) => {
  try {
    const { status, data } = await deleteDataset();
    res.status(status).json(data);
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
function handleError(res: any, error: unknown) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error("Unexpected error in model route", error);
  return res.status(500).json({ error: "Internal server error" });
}
