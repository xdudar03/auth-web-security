import { addItem } from "../database.ts";

function seedItems() {
  // Shop 1
  addItem.run("Apple", 0.99, 1);
  addItem.run("Bread", 2.49, 1);
  addItem.run("Milk", 1.79, 1);

  // Shop 2
  addItem.run("Notebook", 3.99, 2);
  addItem.run("Pen", 1.2, 2);

  // Shop 3
  addItem.run("T-Shirt", 15.0, 3);
  addItem.run("Jeans", 40.0, 3);
}

seedItems();
