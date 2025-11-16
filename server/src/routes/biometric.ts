import { Router } from "express";
import {
  authenticateBiometricUser,
  changeBiometricEmbedding,
  changeBiometricPassword,
  confirmBiometricPassword,
  registerBiometricUser,
} from "../services/biometric.ts";
import { HttpError } from "../errors.ts";
import type { User } from "../types/user.ts";

const router = Router();

router.post("/registration", async (req, res) => {
  try {
    const result = await registerBiometricUser(req.body);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/authentication", async (req, res) => {
  try {
    const result = await authenticateBiometricUser(req.body);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/change", async (req, res) => {
  const user = req.body.user as User;
  try {
    const result = await changeBiometricEmbedding(req.body, user);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/change-password", async (req, res) => {
  const user = req.body.user as User;
  try {
    const result = await changeBiometricPassword(req.body, user);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/confirm-password", async (req, res) => {
  const user = req.body.user as User;
  try {
    const result = await confirmBiometricPassword(req.body, user);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
function handleError(res: any, error: unknown) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error("Unexpected error in biometric route", error);
  return res.status(500).json({ error: "Internal server error" });
}
