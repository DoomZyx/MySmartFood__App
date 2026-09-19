// @ts-nocheck
import { jest } from "@jest/globals";

const findById = jest.fn();
const findForPlatform = jest.fn();
const removeUser = jest.fn();
const listOwnedByUser = jest.fn();
const removeTenant = jest.fn();
const releaseNumber = jest.fn();
const setPhoneLineEnabled = jest.fn();
const recordPlatformAudit = jest.fn();

jest.unstable_mockModule("../../models/pg/User.js", () => ({
  findById,
  findForPlatform,
  remove: removeUser,
  updateAccount: jest.fn(),
  setPassword: jest.fn(),
  setEmailVerified: jest.fn(),
  markDashboardUnlocked: jest.fn(),
  listForPlatform: jest.fn(),
}));

jest.unstable_mockModule("../../models/pg/Tenant.js", () => ({
  listOwnedByUser,
  remove: removeTenant,
}));

jest.unstable_mockModule("../../models/pg/TwilioBundle.js", () => ({
  releaseNumber,
}));

jest.unstable_mockModule("../../models/pg/TenantSettings.js", () => ({
  setPhoneLineEnabled,
}));

jest.unstable_mockModule("./PlatformAuditService.js", () => ({
  recordPlatformAudit,
}));

const { deletePlatformUser } = await import("./PlatformUsersService.js");

const actor = { id: "actor-1", isPlatformOwner: true, isPlatformAdmin: true };
const member = {
  id: "user-2",
  email: "member@example.com",
  isPlatformOwner: false,
  isPlatformAdmin: false,
};

describe("deletePlatformUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findById.mockResolvedValue(member);
    findForPlatform.mockResolvedValue(member);
    listOwnedByUser.mockResolvedValue([]);
    removeTenant.mockResolvedValue(true);
    releaseNumber.mockResolvedValue(undefined);
    setPhoneLineEnabled.mockResolvedValue(undefined);
    removeUser.mockResolvedValue(true);
  });

  test("refuse de supprimer son propre compte", async () => {
    findById.mockResolvedValue({ ...member, id: actor.id });
    await expect(deletePlatformUser(actor, actor.id)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(removeUser).not.toHaveBeenCalled();
  });

  test("refuse de supprimer le propriétaire plateforme", async () => {
    findById.mockResolvedValue({ ...member, isPlatformOwner: true });
    await expect(deletePlatformUser(actor, member.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(removeUser).not.toHaveBeenCalled();
  });

  test("supprime les restaurants du compte puis l'utilisateur", async () => {
    listOwnedByUser.mockResolvedValue([{ id: "t1", name: "Le Zinc" }]);
    const result = await deletePlatformUser(actor, member.id);
    expect(releaseNumber).toHaveBeenCalledWith("t1");
    expect(removeTenant).toHaveBeenCalledWith("t1");
    expect(removeUser).toHaveBeenCalledWith(member.id);
    expect(result).toEqual({ deleted: true, id: member.id, tenantIds: ["t1"] });
  });

  test("supprime un utilisateur sans restaurant", async () => {
    const result = await deletePlatformUser(actor, member.id);
    expect(removeTenant).not.toHaveBeenCalled();
    expect(removeUser).toHaveBeenCalledWith(member.id);
    expect(recordPlatformAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.delete", targetId: member.id })
    );
    expect(result).toEqual({ deleted: true, id: member.id, tenantIds: [] });
  });

  test("renvoie 404 si l'utilisateur n'existe pas", async () => {
    findById.mockResolvedValue(null);
    await expect(deletePlatformUser(actor, "missing")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
