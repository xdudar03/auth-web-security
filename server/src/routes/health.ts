import { Router } from "express";
import { checkHealth, pingHealth } from "../services/health.ts";

const router = Router();

router.get("/", (_req, res) => {
  res.send(pingHealth());
});

router.get("/health", (_req, res) => {
  res.status(200).json(checkHealth());
});

export default router;
