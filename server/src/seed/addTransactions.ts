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
    const row = getItemByNameAndShop(name, shopId);
    if (!row) throw new Error(`Item not found: ${name} @ shop ${shopId}`);
    total += row.itemPrice * qty;
    resolved.push({ itemId: row.itemId, qty });
  }
  return { total, resolved };
}

function seedTransactions() {
  // u103 @ shop 1: Apple x2, Bread x1
  addPseudonym({
    pseudoId: "p103",
    userId: "u103",
    createdAt: new Date().toISOString(),
    expiresAt: null,
  });
  {
    const shopId = 1;
    const items: LineItem[] = [
      { name: "Apple", qty: 2 },
      { name: "Bread", qty: 1 },
    ];
    const { total, resolved } = totalFor(shopId, items);
    addTransaction({
      shopId,
      pseudoId: "p103",
      totalPrice: total,
      location: "Store #1",
      paymentMethod: "card",
      purchaseType: "in_store",
    });
    const id = getLastInsertRowId();
    if (!id) throw new Error("Failed to get last insert row id");
    for (const r of resolved)
      addTransactionItem({
        transactionId: id,
        itemId: r.itemId,
        quantity: r.qty,
      });
    linkUserTransaction("u103", id);
  }

  // u103 additional: Apple x1, Bread x2 (online)
  {
    const shopId = 1;
    const items: LineItem[] = [
      { name: "Apple", qty: 1 },
      { name: "Bread", qty: 2 },
    ];
    const { total, resolved } = totalFor(shopId, items);
    addTransaction({
      shopId,
      pseudoId: "p103",
      totalPrice: total,
      location: "Web Checkout",
      paymentMethod: "google_pay",
      purchaseType: "online",
    });
    const id = getLastInsertRowId();
    if (!id) throw new Error("Failed to get last insert row id");
    for (const r of resolved)
      addTransactionItem({
        transactionId: id,
        itemId: r.itemId,
        quantity: r.qty,
      });
    linkUserTransaction("u103", id);
  }

  // u103 additional: Apple x5 (in_store, cash)
  {
    const shopId = 1;
    const items: LineItem[] = [{ name: "Apple", qty: 5 }];
    const { total, resolved } = totalFor(shopId, items);
    addTransaction({
      shopId,
      pseudoId: "p103",
      totalPrice: total,
      location: "Store #1",
      paymentMethod: "cash",
      purchaseType: "in_store",
    });
    const id = getLastInsertRowId();
    if (!id) throw new Error("Failed to get last insert row id");
    for (const r of resolved)
      addTransactionItem({
        transactionId: id,
        itemId: r.itemId,
        quantity: r.qty,
      });
    linkUserTransaction("u103", id);
  }

  // u104 @ shop 2: Pen x3, Notebook x1
  addPseudonym({
    pseudoId: "p104",
    userId: "u104",
    createdAt: new Date().toISOString(),
    expiresAt: null,
  });
  {
    const shopId = 2;
    const items: LineItem[] = [
      { name: "Pen", qty: 3 },
      { name: "Notebook", qty: 1 },
    ];
    const { total, resolved } = totalFor(shopId, items);
    addTransaction({
      shopId,
      pseudoId: "p104",
      totalPrice: total,
      location: "Kiosk B",
      paymentMethod: "apple_pay",
      purchaseType: "in_store",
    });
    const id = getLastInsertRowId();
    if (!id) throw new Error("Failed to get last insert row id");
    for (const r of resolved)
      addTransactionItem({
        transactionId: id,
        itemId: r.itemId,
        quantity: r.qty,
      });
    linkUserTransaction("u104", id);
  }

  // u104 additional: Pen x1 (card)
  {
    const shopId = 2;
    const items: LineItem[] = [{ name: "Pen", qty: 1 }];
    const { total, resolved } = totalFor(shopId, items);
    addTransaction({
      shopId,
      pseudoId: "p104",
      totalPrice: total,
      location: "Kiosk B",
      paymentMethod: "card",
      purchaseType: "in_store",
    });
    const id = getLastInsertRowId();
    if (!id) throw new Error("Failed to get last insert row id");
    for (const r of resolved)
      addTransactionItem({
        transactionId: id,
        itemId: r.itemId,
        quantity: r.qty,
      });
    linkUserTransaction("u104", id);
  }

  // u104 additional: Notebook x2 (online)
  {
    const shopId = 2;
    const items: LineItem[] = [{ name: "Notebook", qty: 2 }];
    const { total, resolved } = totalFor(shopId, items);
    addTransaction({
      shopId,
      pseudoId: "p104",
      totalPrice: total,
      location: "Stationery Online",
      paymentMethod: "other",
      purchaseType: "online",
    });
    const id = getLastInsertRowId();
    if (!id) throw new Error("Failed to get last insert row id");
    for (const r of resolved)
      addTransactionItem({
        transactionId: id,
        itemId: r.itemId,
        quantity: r.qty,
      });
    linkUserTransaction("u104", id);
  }

  // u105 @ shop 3: T-Shirt x1, Jeans x1
  addPseudonym({
    pseudoId: "p105",
    userId: "u105",
    createdAt: new Date().toISOString(),
    expiresAt: null,
  });
  {
    const shopId = 3;
    const items: LineItem[] = [
      { name: "T-Shirt", qty: 1 },
      { name: "Jeans", qty: 1 },
    ];
    const { total, resolved } = totalFor(shopId, items);
    addTransaction({
      shopId,
      pseudoId: "p105",
      totalPrice: total,
      location: "Outlet C",
      paymentMethod: "card",
      purchaseType: "online",
    });
    const id = getLastInsertRowId();
    if (!id) throw new Error("Failed to get last insert row id");
    for (const r of resolved)
      addTransactionItem({
        transactionId: id,
        itemId: r.itemId,
        quantity: r.qty,
      });
    linkUserTransaction("u105", id);
  }

  // u105 additional: T-Shirt x2 (in_store, cash)
  {
    const shopId = 3;
    const items: LineItem[] = [{ name: "T-Shirt", qty: 2 }];
    const { total, resolved } = totalFor(shopId, items);
    addTransaction({
      shopId,
      pseudoId: "p105",
      totalPrice: total,
      location: "Outlet C",
      paymentMethod: "cash",
      purchaseType: "in_store",
    });
    const id = getLastInsertRowId();
    if (!id) throw new Error("Failed to get last insert row id");
    for (const r of resolved)
      addTransactionItem({
        transactionId: id,
        itemId: r.itemId,
        quantity: r.qty,
      });
    linkUserTransaction("u105", id);
  }

  // u105 additional: Jeans x1 (google_pay, online)
  {
    const shopId = 3;
    const items: LineItem[] = [{ name: "Jeans", qty: 1 }];
    const { total, resolved } = totalFor(shopId, items);
    addTransaction({
      shopId,
      pseudoId: "p105",
      totalPrice: total,
      location: "Outlet C",
      paymentMethod: "google_pay",
      purchaseType: "online",
    });
    const id = getLastInsertRowId();
    if (!id) throw new Error("Failed to get last insert row id");
    for (const r of resolved)
      addTransactionItem({
        transactionId: id,
        itemId: r.itemId,
        quantity: r.qty,
      });
    linkUserTransaction("u105", id);
  }
}

seedTransactions();
