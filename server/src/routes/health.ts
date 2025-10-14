import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.send("Hello World!");
});

router.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

export default router;
