import { addCustomer, addCustomerToShop } from "../database.ts";

const addCustomers = () => {
  addCustomer({
    customerId: "c1",
    isBiometric: false,
  });
  addCustomer({
    customerId: "c2",
    isBiometric: false,
  });
  addCustomer({
    customerId: "c3",
    isBiometric: false,
  });
  addCustomerToShop("c1", 1);
  addCustomerToShop("c2", 1);
  addCustomerToShop("c3", 1);
  addCustomerToShop("c1", 2);
  addCustomerToShop("c2", 2);
  addCustomerToShop("c3", 2);
  addCustomerToShop("c1", 3);
  addCustomerToShop("c2", 3);
  addCustomerToShop("c3", 3);
};

addCustomers();
