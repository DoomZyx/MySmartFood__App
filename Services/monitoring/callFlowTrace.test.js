import { listCallFlow, recordCallFlow, resetCallFlow } from "./callFlowTrace.js";

describe("callFlowTrace", () => {
  beforeEach(() => {
    resetCallFlow();
  });

  it("enregistre un raccrochage et le masque l'appelant", () => {
    recordCallFlow({
      callSid: "CA123",
      from: "+33672886255",
      to: "+33939036540",
      slug: "handlehome",
      stage: "tenant",
      outcome: "hangup",
      detail: "tenant introuvable",
    });
    const rows = listCallFlow();
    expect(rows).toHaveLength(1);
    expect(rows[0].outcome).toBe("hangup");
    expect(rows[0].fromMasked).toBe("***6255");
    expect(rows[0].to).toBe("+33939036540");
    expect(rows[0].detail).toBe("tenant introuvable");
    expect(listCallFlow("other-tenant")).toEqual([]);
  });

  it("filtre par tenant quand l'identifiant est connu", () => {
    recordCallFlow({ tenantId: "tenant-1", stage: "twiml", outcome: "ok", detail: "ok" });
    recordCallFlow({ tenantId: "tenant-2", stage: "twiml", outcome: "hangup", detail: "off" });
    expect(listCallFlow("tenant-1")).toHaveLength(1);
    expect(listCallFlow("tenant-1")[0].outcome).toBe("ok");
  });
});
