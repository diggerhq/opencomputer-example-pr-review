import { randomUUID } from "node:crypto";

export interface Order {
  id: string;
  customerId: string;
  items: Array<{ sku: string; quantity: number; unitPriceCents: number }>;
  status: "pending" | "paid" | "shipped" | "cancelled";
  createdAt: string;
}

const orders = new Map<string, Order>();

export function createOrder(
  customerId: string,
  items: Order["items"],
): Order {
  const order: Order = {
    id: randomUUID(),
    customerId,
    items,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  orders.set(order.id, order);
  return order;
}

export function getOrder(id: string): Order | undefined {
  return orders.get(id);
}

export function listOrders(customerId: string): Order[] {
  return [...orders.values()]
    .filter((order) => order.customerId === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function orderTotalCents(order: Order): number {
  return order.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceCents,
    0,
  );
}
