import { Router } from "express";
import { getUserWithRoleById, listUsers } from "../services/admin.ts";

const router = Router();

router.get("/users", async (_req, res) => {
  const users = listUsers();
  return res.status(200).json({ users });
});

router.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = getUserWithRoleById(id);
    return res.status(200).json(user);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});

// router.post("/users/:id", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const result = updateUser(id, req.body);
//     return res.status(200).json(result);
//   } catch (error) {
//     if (error instanceof Error) {
//       return res.status(400).json({ error: error.message });
//     }
//     return res.status(500).json({ error: "Internal server error" });
//   }
// });

export default router;
