import { addItem } from "../database.ts";

function seedItems() {
  // Shop 1
  addItem({
    itemName: "Apple",
    itemPrice: 0.99,
    shopId: 1,
  });
  addItem({
    itemName: "Bread",
    itemPrice: 2.49,
    shopId: 1,
  });
  addItem({
    itemName: "Milk",
    itemPrice: 1.79,
    shopId: 1,
  });

  // Shop 2
  addItem({
    itemName: "Notebook",
    itemPrice: 3.99,
    shopId: 2,
  });
  addItem({
    itemName: "Pen",
    itemPrice: 1.2,
    shopId: 2,
  });

  // Shop 3
  addItem({
    itemName: "T-Shirt",
    itemPrice: 15.0,
    shopId: 3,
  });
  addItem({
    itemName: "Jeans",
    itemPrice: 40.0,
    shopId: 3,
  });
}

seedItems();
