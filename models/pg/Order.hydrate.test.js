import { list, findById } from "./Order.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORDER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ITEM_A1 = "ccccccc1-cccc-4ccc-8ccc-cccccccccccc";
const ITEM_A2 = "ccccccc2-cccc-4ccc-8ccc-cccccccccccc";
const ITEM_B1 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function orderRow(id) {
  return {
    id,
    tenant_id: TENANT_ID,
    guest_name: "Client",
    guest_phone: "0600000000",
    status: "pending",
    total_cents: 1000,
    pickup_at: "2026-09-18T10:00:00.000Z",
    created_at: "2026-09-18T09:00:00.000Z",
  };
}

function itemRow(id, orderId, label) {
  return {
    id,
    tenant_id: TENANT_ID,
    order_id: orderId,
    menu_item_id: null,
    label,
    quantity: 1,
    unit_price_cents: 500,
    category: "pizzas",
    composition: "",
    created_at: "2026-09-18T09:01:00.000Z",
  };
}

function mockClient(handlers) {
  const calls = [];
  return {
    calls,
    query: async (sql, values) => {
      calls.push(sql);
      for (const handler of handlers) {
        if (handler.match(sql)) return handler.result(sql, values);
      }
      throw new Error(`Requête non mockée: ${sql}`);
    },
  };
}

describe("Order hydrate batch", () => {
  test("list charge items et options en 2 requêtes, pas en N+1", async () => {
    const client = mockClient([
      {
        match: (sql) => sql.includes("FROM orders o") && sql.includes("LIMIT"),
        result: () => ({ rows: [orderRow(ORDER_A), orderRow(ORDER_B)] }),
      },
      {
        match: (sql) => sql.includes("COUNT(*)"),
        result: () => ({ rows: [{ total: 2 }] }),
      },
      {
        match: (sql) => sql.includes("FROM order_items"),
        result: (_sql, values) => {
          expect(values[1]).toEqual([ORDER_A, ORDER_B]);
          return {
            rows: [
              itemRow(ITEM_A1, ORDER_A, "Margherita"),
              itemRow(ITEM_A2, ORDER_A, "Coca"),
              itemRow(ITEM_B1, ORDER_B, "Burger"),
            ],
          };
        },
      },
      {
        match: (sql) => sql.includes("FROM order_item_options"),
        result: (_sql, values) => {
          expect(values[1]).toEqual([ITEM_A1, ITEM_A2, ITEM_B1]);
          return {
            rows: [
              {
                orderItemId: ITEM_A1,
                groupName: "sauce",
                optionName: "barbecue",
                priceCents: 0,
              },
            ],
          };
        },
      },
    ]);

    const result = await list(client, TENANT_ID, { page: 1, limit: 50 });

    expect(client.calls.filter((sql) => sql.includes("FROM order_items"))).toHaveLength(1);
    expect(client.calls.filter((sql) => sql.includes("FROM order_item_options"))).toHaveLength(1);
    expect(result.total).toBe(2);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].items).toHaveLength(2);
    expect(result.rows[0].items[0].options).toEqual([
      { groupName: "sauce", optionName: "barbecue", priceCents: 0 },
    ]);
    expect(result.rows[0].items[1].options).toEqual([]);
    expect(result.rows[1].items[0].label).toBe("Burger");
    expect(result.rows[1].items[0].options).toEqual([]);
  });

  test("list vide ne lit pas items ni options", async () => {
    const client = mockClient([
      {
        match: (sql) => sql.includes("FROM orders o") && sql.includes("LIMIT"),
        result: () => ({ rows: [] }),
      },
      {
        match: (sql) => sql.includes("COUNT(*)"),
        result: () => ({ rows: [{ total: 0 }] }),
      },
    ]);

    const result = await list(client, TENANT_ID, { page: 1, limit: 50 });
    expect(result.rows).toEqual([]);
    expect(client.calls.some((sql) => sql.includes("FROM order_items"))).toBe(false);
  });

  test("findById sans items ne lit pas les options", async () => {
    const client = mockClient([
      {
        match: (sql) => sql.includes("FROM orders WHERE"),
        result: () => ({ rows: [orderRow(ORDER_A)] }),
      },
      {
        match: (sql) => sql.includes("FROM order_items"),
        result: () => ({ rows: [] }),
      },
    ]);

    const order = await findById(client, TENANT_ID, ORDER_A);
    expect(order.items).toEqual([]);
    expect(client.calls.some((sql) => sql.includes("FROM order_item_options"))).toBe(false);
  });
});
