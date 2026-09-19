// @ts-nocheck
import { jest } from "@jest/globals";

const extractCallData = jest.fn();
const notifyCallEnded = jest.fn();
const process = jest.fn();

jest.unstable_mockModule("../../Services/gptServices/extractCallData.js", () => ({
  extractCallData,
}));

jest.unstable_mockModule("../../Services/notificationService.js", () => ({
  default: { notifyCallEnded },
}));

jest.unstable_mockModule("./ProcessCallService.js", () => ({
  ProcessCallService: { process },
}));

const { VoiceHangupService } = await import("./VoiceHangupService.js");

const TENANT_ID = "ff3e05bf-2da5-465c-a7a2-f635021f49a9";

describe("VoiceHangupService", () => {
  beforeEach(() => {
    extractCallData.mockReset();
    notifyCallEnded.mockReset();
    process.mockReset();
  });

  test("turnsToTranscription assemble Client/Assistant sans roles techniques", () => {
    const text = VoiceHangupService.turnsToTranscription([
      { role: "assistant", content: "Bonjour" },
      { role: "user", content: "Une table pour deux" },
    ]);
    expect(text).toBe("Assistant: Bonjour\nClient: Une table pour deux");
  });

  test("tool create puis hangup: notif avec id, aucune persistance", async () => {
    extractCallData.mockResolvedValue({
      nom: "Ada",
      telephone: "0612345678",
      type_demande: "Réservation de table",
      reservation: { date: "2026-09-15", heure: "12:00" },
    });

    const result = await VoiceHangupService.complete(
      {
        turns: [{ role: "user", content: "oui" }],
        liveCreate: { type: "reservation", id: "resa1" },
      },
      { instanceId: TENANT_ID, streamSid: "MZ1" },
    );

    expect(result.persisted).toBe(false);
    expect(result.liveCreate).toEqual({ type: "reservation", id: "resa1" });
    expect(process).not.toHaveBeenCalled();
    expect(notifyCallEnded).toHaveBeenCalledWith(
      expect.objectContaining({ type_demande: "Réservation de table" }),
      { orderId: "resa1", appointmentType: "reservation", tenantId: TENANT_ID },
    );
  });

  test("hangup sans tool: notif sans creation, extract ignore pour insert", async () => {
    extractCallData.mockResolvedValue({
      nom: "Ada",
      telephone: "0612345678",
      type_demande: "Commande à emporter",
      order: { date: "2026-09-15", heure: "19:00", commandes: [{ nom: "Burger", quantite: 1 }] },
    });

    const result = await VoiceHangupService.complete(
      {
        turns: [{ role: "user", content: "un burger" }],
        liveCreate: null,
      },
      { instanceId: TENANT_ID, streamSid: "MZ1" },
    );

    expect(result.persisted).toBe(false);
    expect(result.liveCreate).toBeNull();
    expect(process).not.toHaveBeenCalled();
    expect(notifyCallEnded).toHaveBeenCalledWith(
      expect.objectContaining({ nom: "Ada" }),
      { orderId: null, appointmentType: null, tenantId: TENANT_ID },
    );
  });
});
