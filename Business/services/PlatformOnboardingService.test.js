// @ts-nocheck
import { jest } from "@jest/globals";

const findByEmail = jest.fn();
const createUser = jest.fn();
const setPassword = jest.fn();
const updateAccount = jest.fn();
const markDashboardUnlocked = jest.fn();
const updateDetails = jest.fn();
const updateOpenAi = jest.fn();
const findProfileByTenantId = jest.fn();
const listByUserId = jest.fn();
const findMembership = jest.fn();
const listByTenantId = jest.fn();
const createMembership = jest.fn();
const createTenantModel = jest.fn();
const findForPlatform = jest.fn();
const findById = jest.fn();
const findBySlugPlan = jest.fn();
const createManual = jest.fn();
const upsertProfile = jest.fn();
const createProvisioningJob = jest.fn();
const markCompleted = jest.fn();
const incomingNumberVoiceUpdate = jest.fn();
const resolveVoicePublicHost = jest.fn();
const voiceWebhookUrl = jest.fn();
const assignNumber = jest.fn();
const findByPhoneNumber = jest.fn();
const incomingUpdate = jest.fn();
const incomingList = jest.fn();
const incomingFetch = jest.fn();

jest.unstable_mockModule("twilio", () => ({
  default: () => ({
    incomingPhoneNumbers: Object.assign((sid) => ({
      fetch: incomingFetch,
      update: incomingUpdate,
    }), {
      list: incomingList,
    }),
  }),
}));

jest.unstable_mockModule("../../models/pg/User.js", () => ({
  findByEmail,
  create: createUser,
  setPassword,
  updateAccount,
  markDashboardUnlocked,
  listByTenantId,
}));

jest.unstable_mockModule("../../models/pg/Membership.js", () => ({
  listByUserId,
  createMembership,
  findMembership,
}));

jest.unstable_mockModule("../../models/pg/Tenant.js", () => ({
  createTenant: createTenantModel,
  findForPlatform,
  findById,
  updateDetails,
  updateOpenAi,
  slugFromName: (name, suffix) => `slug-${suffix}`,
}));

jest.unstable_mockModule("../../models/pg/Plan.js", () => ({
  findBySlug: findBySlugPlan,
}));

jest.unstable_mockModule("../../models/pg/Subscription.js", () => ({
  createManual,
}));

jest.unstable_mockModule("../../models/pg/EstablishmentProfile.js", () => ({
  upsert: upsertProfile,
  findByTenantId: findProfileByTenantId,
}));

jest.unstable_mockModule("../../models/pg/ProvisioningJob.js", () => ({
  createProvisioningJob,
  markCompleted,
  markRejected: jest.fn(),
}));

jest.unstable_mockModule("../../models/pg/TwilioBundle.js", () => ({
  assignNumber,
  findByPhoneNumber,
  findByTenantId: jest.fn(),
  releaseNumber: jest.fn(),
}));

jest.unstable_mockModule("../../models/pg/Contact.js", () => ({
  findWithFilter: jest.fn(),
}));

jest.unstable_mockModule("../../models/pg/Demo.js", () => ({
  findWithFilter: jest.fn(),
}));

jest.unstable_mockModule("../../database/transaction.js", () => ({
  withTransaction: async (fn) => fn({
    query: jest.fn().mockResolvedValue({ rowCount: 0 }),
  }),
  withTenant: async (_id, fn) => fn({ query: jest.fn() }),
}));

jest.unstable_mockModule("../../utils/voiceWebhookUrl.js", () => ({
  incomingNumberVoiceUpdate,
  resolveVoicePublicHost,
  voiceWebhookUrl,
}));

const { createPlatformTenant, updatePlatformTenant, updatePlatformTenantUser, parseOptionalInboundPhone, buildValidationChecklist, isCompanyDossierComplete } = await import(
  "./PlatformOnboardingService.js"
);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";

const platformRow = {
  id: TENANT_ID,
  slug: "slug-11111111",
  name: "Chez Test",
  status: "active",
  countryCode: "FR",
  ownerUserId: USER_ID,
  ownerEmail: "resto@example.com",
  onboardedBy: "platform",
};

function resetMocks() {
  findByEmail.mockReset();
  createUser.mockReset();
  setPassword.mockReset();
  updateAccount.mockReset();
  markDashboardUnlocked.mockReset();
  updateDetails.mockReset();
  updateOpenAi.mockReset();
  findProfileByTenantId.mockReset();
  listByUserId.mockReset();
  findMembership.mockReset();
  listByTenantId.mockReset();
  createMembership.mockReset();
  createTenantModel.mockReset();
  findForPlatform.mockReset();
  findById.mockReset();
  findBySlugPlan.mockReset();
  createManual.mockReset();
  upsertProfile.mockReset();
  createProvisioningJob.mockReset();
  markCompleted.mockReset();
  incomingNumberVoiceUpdate.mockReset();
  resolveVoicePublicHost.mockReset();
  voiceWebhookUrl.mockReset();
  assignNumber.mockReset();
  findByPhoneNumber.mockReset();
  incomingUpdate.mockReset();
  incomingList.mockReset();
  incomingFetch.mockReset();

  findBySlugPlan.mockResolvedValue({ id: "plan-beta", slug: "beta" });
  createTenantModel.mockResolvedValue({
    id: TENANT_ID,
    slug: "slug-11111111",
    name: "Chez Test",
    status: "active",
    onboardedBy: "platform",
  });
  findForPlatform.mockResolvedValue(platformRow);
  resolveVoicePublicHost.mockResolvedValue("https://example.com");
  voiceWebhookUrl.mockReturnValue("https://example.com/twilio/incoming-call");
}

describe("parseOptionalInboundPhone", () => {
  test("vide : aucune attribution", () => {
    expect(parseOptionalInboundPhone({})).toBe(null);
    expect(parseOptionalInboundPhone({ phoneNumber: "  " })).toBe(null);
  });

  test("E.164 ou SID", () => {
    expect(parseOptionalInboundPhone({ phoneNumber: "+33123456789" })).toEqual({
      phoneNumber: "+33123456789",
    });
    expect(parseOptionalInboundPhone({
      phoneNumber: "1 (276) 881 - 1832",
    })).toEqual({
      phoneNumber: "+12768811832",
    });
    expect(parseOptionalInboundPhone({
      phoneNumberSid: "PNaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    })).toEqual({
      phoneNumberSid: "PNaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
  });
});

describe("createPlatformTenant", () => {
  beforeEach(() => {
    resetMocks();
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "token";
  });

  test("crée user + tenant plateforme", async () => {
    findByEmail.mockResolvedValue(null);
    createUser.mockResolvedValue({ id: USER_ID, email: "resto@example.com" });

    const result = await createPlatformTenant({
      email: "resto@example.com",
      password: "motdepasse",
      name: "Chez Test",
      countryCode: "FR",
    });

    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      email: "resto@example.com",
      password: "motdepasse",
      emailVerified: true,
    }));
    expect(createTenantModel).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: "Chez Test",
        status: "active",
        onboardedBy: "platform",
        countryCode: "FR",
      })
    );
    expect(markCompleted).toHaveBeenCalledWith(TENANT_ID);
    expect(markDashboardUnlocked).toHaveBeenCalledWith(USER_ID);
    expect(incomingNumberVoiceUpdate).not.toHaveBeenCalled();
    expect(result.temporaryPassword).toBe("motdepasse");
    expect(result.tenant.id).toBe(TENANT_ID);
  });

  test("rattache un user existant sans resto", async () => {
    findByEmail.mockResolvedValue({ id: USER_ID, email: "deja@example.com" });
    listByUserId.mockResolvedValue([]);

    await createPlatformTenant({
      email: "deja@example.com",
      password: "nouveaupass",
      name: "Chez Test",
    });

    expect(createUser).not.toHaveBeenCalled();
    expect(setPassword).toHaveBeenCalledWith(USER_ID, "nouveaupass");
    expect(createTenantModel).toHaveBeenCalled();
  });

  test("409 si le user a déjà un établissement", async () => {
    findByEmail.mockResolvedValue({ id: USER_ID, email: "deja@example.com" });
    listByUserId.mockResolvedValue([{ tenantId: "other", status: "pending_compliance" }]);

    await expect(createPlatformTenant({
      email: "deja@example.com",
      password: "motdepasse",
      name: "Chez Test",
    })).rejects.toMatchObject({
      message: "Ce compte possède déjà un établissement",
      statusCode: 409,
    });
    expect(createTenantModel).not.toHaveBeenCalled();
  });

  test("numéro optionnel : attribution si fourni", async () => {
    findByEmail.mockResolvedValue(null);
    createUser.mockResolvedValue({ id: USER_ID, email: "resto@example.com" });
    findById.mockResolvedValue({
      id: TENANT_ID,
      slug: "slug-11111111",
      status: "active",
    });
    incomingNumberVoiceUpdate.mockResolvedValue({
      voiceUrl: "https://example.com/twilio/incoming-call",
      voiceMethod: "POST",
    });
    incomingList.mockResolvedValue([{
      sid: "PNbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      phoneNumber: "+33123456789",
    }]);
    findByPhoneNumber.mockResolvedValue(null);
    incomingUpdate.mockResolvedValue({});
    assignNumber.mockResolvedValue({});

    await createPlatformTenant({
      email: "resto@example.com",
      password: "motdepasse",
      name: "Chez Test",
      phoneNumber: "+33123456789",
    });

    expect(incomingNumberVoiceUpdate).toHaveBeenCalled();
    expect(assignNumber).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({ phoneNumber: "+33123456789" })
    );
  });
});

describe("buildValidationChecklist", () => {
  test("self-service incomplet sans adresse ni dossier", () => {
    const checklist = buildValidationChecklist({
      onboardedBy: "self",
      name: "Chez Test",
      ownerEmail: "a@b.c",
    });
    expect(checklist.ready).toBe(false);
    expect(checklist.items.find((item) => item.key === "address").ok).toBe(false);
    expect(checklist.items.find((item) => item.key === "documents").ok).toBe(false);
  });

  test("plateforme : dossier optionnel, adresse + numéro requis pour ready", () => {
    const checklist = buildValidationChecklist({
      onboardedBy: "platform",
      businessName: "Chez Test",
      ownerEmail: "a@b.c",
      addressLine: "1 rue",
      postalCode: "75001",
      city: "Paris",
      restaurantPhone: "0102030405",
      phoneNumberUsage: "Standard téléphonique du restaurant pour les clients.",
      phoneNumber: "+33123456789",
    });
    expect(checklist.items.find((item) => item.key === "documents").ok).toBe(true);
    expect(checklist.ready).toBe(true);
  });

  test("self-service complet avec profil, SIRET et pièces d'identité", () => {
    const row = {
      onboardedBy: "self",
      businessName: "Chez Test",
      ownerEmail: "a@b.c",
      addressLine: "1 rue",
      postalCode: "75001",
      city: "Paris",
      restaurantPhone: "0102030405",
      phoneNumberUsage: "Standard téléphonique du restaurant pour les clients.",
      documentsSubmittedAt: "2026-01-01",
      documentKinds: ["id_recto", "id_verso", "address_proof"],
      siret: "73282932000074",
      siren: "732829320",
    };
    expect(isCompanyDossierComplete(row)).toBe(true);
    expect(isCompanyDossierComplete({ ...row, documentKinds: ["id_recto"] })).toBe(false);
    expect(isCompanyDossierComplete({ ...row, siret: null, siren: null })).toBe(false);
  });
});

describe("updatePlatformTenant", () => {
  beforeEach(() => {
    resetMocks();
  });

  test("met à jour le profil et le propriétaire", async () => {
    findById.mockResolvedValue({
      id: TENANT_ID,
      name: "Chez Test",
      status: "active",
      countryCode: "FR",
      ownerUserId: USER_ID,
    });
    findProfileByTenantId.mockResolvedValue({
      businessName: "Chez Test",
      addressLine: "",
      country: "France",
    });
    updateDetails.mockResolvedValue(true);
    updateAccount.mockResolvedValue({ id: USER_ID });
    upsertProfile.mockResolvedValue({});

    await updatePlatformTenant(TENANT_ID, {
      name: "Chez Nouveau",
      ownerName: "Ada",
      email: "ada@example.com",
      addressLine: "10 rue Test",
      postalCode: "75002",
      city: "Paris",
      restaurantPhone: "0102030405",
    });

    expect(updateDetails).toHaveBeenCalledWith(
      null,
      TENANT_ID,
      expect.objectContaining({ name: "Chez Nouveau", countryCode: "FR" })
    );
    expect(updateAccount).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ name: "Ada", email: "ada@example.com" })
    );
    expect(upsertProfile).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({
        businessName: "Chez Nouveau",
        addressLine: "10 rue Test",
        postalCode: "75002",
        city: "Paris",
        phone: "0102030405",
      })
    );
    expect(incomingNumberVoiceUpdate).not.toHaveBeenCalled();
    expect(updateOpenAi).not.toHaveBeenCalled();
  });

  test("enregistre la clé OpenAI optionnelle et le modèle Realtime", async () => {
    findById.mockResolvedValue({
      id: TENANT_ID,
      name: "Chez Test",
      status: "active",
      countryCode: "FR",
      ownerUserId: USER_ID,
    });
    findProfileByTenantId.mockResolvedValue({ businessName: "Chez Test" });
    updateDetails.mockResolvedValue(true);
    upsertProfile.mockResolvedValue({});
    updateOpenAi.mockResolvedValue(true);

    await updatePlatformTenant(TENANT_ID, {
      openaiApiKey: "sk-tenant-fallback-key-12345",
      openaiModel: "gpt-realtime-1.5",
    });

    expect(updateOpenAi).toHaveBeenCalledWith(
      null,
      TENANT_ID,
      expect.objectContaining({
        apiKey: "sk-tenant-fallback-key-12345",
        model: "gpt-realtime-1.5",
      })
    );
  });

  test("404 si tenant introuvable", async () => {
    findById.mockResolvedValue(null);
    await expect(updatePlatformTenant(TENANT_ID, { name: "X" })).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("updatePlatformTenantUser", () => {
  beforeEach(() => {
    resetMocks();
  });

  test("met à jour nom, e-mail et mot de passe d'un membre", async () => {
    findById.mockResolvedValue({
      id: TENANT_ID,
      status: "active",
      ownerUserId: USER_ID,
    });
    findMembership.mockResolvedValue({ userId: USER_ID, tenantId: TENANT_ID, role: "owner" });
    updateAccount.mockResolvedValue({ id: USER_ID });
    setPassword.mockResolvedValue(true);
    listByTenantId.mockResolvedValue([
      {
        id: USER_ID,
        email: "ada@example.com",
        name: "Ada",
        membershipRole: "owner",
        lastLoginAt: null,
      },
    ]);
    findForPlatform.mockResolvedValue({
      ...platformRow,
      ownerEmail: "ada@example.com",
      ownerName: "Ada",
    });

    const result = await updatePlatformTenantUser(TENANT_ID, USER_ID, {
      name: "Ada",
      email: "ada@example.com",
      password: "nouveaupass",
    });

    expect(updateAccount).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ name: "Ada", email: "ada@example.com" })
    );
    expect(setPassword).toHaveBeenCalledWith(USER_ID, "nouveaupass");
    expect(result.user).toMatchObject({
      id: USER_ID,
      email: "ada@example.com",
      name: "Ada",
      role: "owner",
    });
    expect(result.users).toHaveLength(1);
  });

  test("404 si le user n'appartient pas au restaurant", async () => {
    findById.mockResolvedValue({ id: TENANT_ID, status: "active" });
    findMembership.mockResolvedValue(null);
    await expect(
      updatePlatformTenantUser(TENANT_ID, USER_ID, { name: "Ada" })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
