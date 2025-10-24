import { db } from "../database.ts";

export function getAllShops() {
  const shops = db.prepare("SELECT * FROM shops").all();
  console.log("shops: ", shops);
  return {
    shops: shops,
  };
}
