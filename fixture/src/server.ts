import express from "express";
import { createOrder, getOrder, listOrders, orderTotalCents } from "./orders.js";

const app = express();
app.use(express.json());

app.post("/orders", (req, res) => {
  const { customerId, items } = req.body ?? {};
  if (typeof customerId !== "string" || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "customerId and non-empty items are required" });
    return;
  }
  const order = createOrder(customerId, items);
  res.status(201).json({ ...order, totalCents: orderTotalCents(order) });
});

app.get("/orders/:id", (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) {
    res.status(404).json({ error: "order not found" });
    return;
  }
  res.json({ ...order, totalCents: orderTotalCents(order) });
});

app.get("/customers/:customerId/orders", (req, res) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);
  res.json(listOrders(req.params.customerId, page, pageSize));
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`orders api listening on :${port}`);
});
