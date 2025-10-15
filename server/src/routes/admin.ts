import { Router } from "express";
import { db, updateUser } from "../database.ts";
import { mapResponseQuery } from "../utils.ts";

const router = Router();

router.get("/users", async (_req, res) => {
  const usersFromDB = db
    .prepare("SELECT * FROM users JOIN roles ON roles.id = users.roleId")
    .all();

  const response = usersFromDB.map((user: any) => {
    const result = mapResponseQuery(user);
    const { user: userData, role: roleData, ...rest } = result;
    const { embedding, credentials, password, ...safeUser } = userData;
    const {
      canChangeUsersCredentials,
      canChangeUsersRoles,
      canReadUsers,
      canReadUsersCredentials,
      canReadUsersSettings,
      canReadUsersRoles,
      canAccessAdminPanel,
      canAccessUserPanel,
      ...safeRole
    } = roleData;

    return {
      ...rest,
      user: safeUser,
      role: safeRole,
    };
  });

  return res.status(200).json({ users: response });
});

router.get("/users/:id", async (req, res) => {
  const { id } = req.params;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.status(200).json(JSON.stringify(user));
});

router.post("/users/:id", async (req, res) => {
  const { id } = req.params;
  const { updates } = req.body;
  updateUser(Number(id), updates);
  return res.status(200).json({ message: "User updated successfully" });
});

export default router;
