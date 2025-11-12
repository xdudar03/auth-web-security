import app from "./app.ts";
import { port } from "./config.ts";
import { db } from "./database.ts";

console.log("Init server");
console.log("cwd", process.cwd());

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  const usersFromDB = db.prepare("SELECT * FROM users").all();
  console.log("USERS FROM DATABASE:", usersFromDB.length);
});
