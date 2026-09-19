// @ts-nocheck
import { jest } from "@jest/globals";

const insert = jest.fn();

jest.unstable_mockModule("../models/pg/DashboardNotification.js", () => ({
  insert,
  listUnread: jest.fn(),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
}));

jest.unstable_mockModule("../database/transaction.js", () => ({
  withTenant: async (_tenantId, fn) => fn({}),
}));

const { default: notificationService } = await import("./notificationService.js");

const TENANT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function mockSocket(tenantId) {
  return {
    readyState: 1,
    send: jest.fn(),
  };
}

describe("NotificationService tenant scoping", () => {
  beforeEach(() => {
    insert.mockReset();
    insert.mockResolvedValue({ id: "11111111-1111-1111-1111-111111111111", createdAt: "2026-09-18T08:00:00.000Z" });
    notificationService.connections.clear();
  });

  test("n'envoie qu'aux sockets du tenant cible", async () => {
    const socketA = mockSocket();
    const socketB = mockSocket();
    notificationService.addConnection(socketA, { tenantIds: [TENANT_A] });
    notificationService.addConnection(socketB, { tenantIds: [TENANT_B] });

    await notificationService.sendNotification("call_completed", { title: "Resa" }, TENANT_A);

    expect(insert).toHaveBeenCalled();
    expect(socketA.send).toHaveBeenCalledTimes(1);
    expect(socketB.send).not.toHaveBeenCalled();
    const payload = JSON.parse(socketA.send.mock.calls[0][0]);
    expect(payload.notificationType).toBe("call_completed");
    expect(payload.data.id).toBe("11111111-1111-1111-1111-111111111111");
  });

  test("persiste un appel manqué même sans websocket", async () => {
    await notificationService.notifyMissedCall({
      tenantId: TENANT_A,
      caller: "+33123456789",
      transferred: false,
    });

    expect(insert).toHaveBeenCalledWith(
      {},
      TENANT_A,
      expect.objectContaining({ notificationType: "call_missed" })
    );
  });
});
