import {
  addPseudonym,
  addTransaction,
  addTransactionItem,
  linkUserTransaction,
  getItemByNameAndShop,
  getLastInsertRowId,
} from "../database.ts";

type LineItem = { name: string; qty: number };

function totalFor(
  shopId: number,
  items: LineItem[]
): {
  total: number;
  resolved: Array<{ itemId: number; qty: number }>;
} {
  let total = 0;
  const resolved: Array<{ itemId: number; qty: number }> = [];
  for (const { name, qty } of items) {
    const row = getItemByNameAndShop.get(name, shopId) as
      | { itemId: number; itemPrice: number }
      | undefined;
    if (!row) throw new Error(`Item not found: ${name} @ shop ${shopId}`);
    total += row.itemPrice * qty;
    resolved.push({ itemId: row.itemId, qty });
  }
  return { total, resolved };
}

function seedTransactions() {
  // u103 @ shop 1: Apple x2, Bread x1
  addPseudonym.run("p103", "u103", null);
  {
    const shopId = 1;
    const items: LineItem[] = [
      { name: "Apple", qty: 2 },
      { name: "Bread", qty: 1 },
    ];
    const { total, resolved } = totalFor(shopId, items);
    addTransaction.run(shopId, "p103", total, "Store #1", "card", "in_store");
    const { id } = getLastInsertRowId.get() as { id: number };
    for (const r of resolved) addTransactionItem.run(id, r.itemId, r.qty);
    linkUserTransaction.run("u103", id);
  }

  // u104 @ shop 2: Pen x3, Notebook x1
  addPseudonym.run("p104", "u104", null);
  {
    const shopId = 2;
    const items: LineItem[] = [
      { name: "Pen", qty: 3 },
      { name: "Notebook", qty: 1 },
    ];
    const { total, resolved } = totalFor(shopId, items);
    addTransaction.run(
      shopId,
      "p104",
      total,
      "Kiosk B",
      "apple_pay",
      "in_store"
    );
    const { id } = getLastInsertRowId.get() as { id: number };
    for (const r of resolved) addTransactionItem.run(id, r.itemId, r.qty);
    linkUserTransaction.run("u104", id);
  }

  // u105 @ shop 3: T-Shirt x1, Jeans x1
  addPseudonym.run("p105", "u105", null);
  {
    const shopId = 3;
    const items: LineItem[] = [
      { name: "T-Shirt", qty: 1 },
      { name: "Jeans", qty: 1 },
    ];
    const { total, resolved } = totalFor(shopId, items);
    addTransaction.run(shopId, "p105", total, "Outlet C", "card", "online");
    const { id } = getLastInsertRowId.get() as { id: number };
    for (const r of resolved) addTransactionItem.run(id, r.itemId, r.qty);
    linkUserTransaction.run("u105", id);
  }
}

seedTransactions();
