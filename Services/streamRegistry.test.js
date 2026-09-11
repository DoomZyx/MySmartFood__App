import {
  getActiveCalls,
  registerStream,
  unregisterStream,
  updateStreamRoute,
} from "./streamRegistry.js";

describe("streamRegistry monitoring", () => {
  const streamSid = "MZ_test_stream";

  afterEach(() => {
    unregisterStream(streamSid);
  });

  it("retourne uniquement les champs admin sanitizés", () => {
    registerStream(streamSid, { readyState: 1 }, "CA_test_call", {
      route: "voice-server",
      instanceId: "inst_test",
      stage: "active",
      callerNumber: "+33123456789",
    });

    const [call] = getActiveCalls();

    expect(Object.keys(call)).toEqual([
      "streamSid",
      "callSid",
      "startedAt",
      "elapsedSeconds",
      "route",
      "instanceId",
      "stage",
    ]);
    expect(call).toMatchObject({
      streamSid,
      callSid: "CA_test_call",
      route: "voice-server",
      instanceId: "inst_test",
      stage: "active",
    });
    expect(call).not.toHaveProperty("connection");
    expect(call).not.toHaveProperty("callerNumber");
    expect(Number.isNaN(Date.parse(call.startedAt))).toBe(false);
  });

  it("met à jour uniquement la route et la phase", () => {
    registerStream(streamSid, { readyState: 1 }, "CA_test_call", {
      route: "pending",
      instanceId: "inst_test",
      stage: "routing",
    });

    expect(
      updateStreamRoute(streamSid, {
        route: "openai-realtime",
        stage: "listening",
        instanceId: "inst_other",
      }),
    ).toBe(true);

    expect(getActiveCalls()[0]).toMatchObject({
      route: "openai-realtime",
      stage: "listening",
      instanceId: "inst_test",
    });
  });
});
