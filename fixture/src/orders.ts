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

export function listOrders(
  customerId: string,
  page = 1,
  pageSize = 20,
): Order[] {
  const all = [...orders.values()]
    .filter((order) => order.customerId === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const start = (page - 1) * pageSize;
  return all.slice(start, start + pageSize + 1);
}

// Orders of 10 or more items get a 10% bulk discount.
const BULK_DISCOUNT_MIN_ITEMS = 10;
const BULK_DISCOUNT_RATE = 0.1;

export function orderTotalCents(order: Order): number {
  const subtotal = order.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceCents,
    0,
  );
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  if (itemCount > BULK_DISCOUNT_MIN_ITEMS) {
    return subtotal * (1 - BULK_DISCOUNT_RATE);
  }
  return subtotal;
}
