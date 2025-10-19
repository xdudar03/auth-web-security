import { Router } from "express";
import {
  getAuthenticationOptions,
  getRegistrationOptions,
  verifyAuthentication,
  verifyRegistration,
} from "../services/passwordless.ts";
import { HttpError } from "../errors.ts";

const router = Router();

router.post("/authentication/options", async (req, res) => {
  try {
    const options = await getAuthenticationOptions(
      req.body?.username,
      req.session
    );
    res.json(options);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/authentication/verify", async (req, res) => {
  try {
    const result = await verifyAuthentication(req.body, req.session);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/registration/options", async (req, res) => {
  try {
    const options = await getRegistrationOptions(
      req.body?.username,
      req.session
    );
    res.json(options);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/registration/verify", async (req, res) => {
  try {
    const result = await verifyRegistration(req.body, req.session);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
function handleError(res: any, error: unknown) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error("Unexpected error in passwordless route", error);
  return res.status(500).json({ error: "Internal server error" });
}
