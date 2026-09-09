import {
  getAllMetrics,
  getErrorRates,
  recordParsingError,
  recordSuccessfulExtraction,
  resetMetrics,
} from "./extractionMetrics.js";

describe("extractionMetrics", () => {
  beforeEach(() => {
    resetMetrics();
  });

  it("calcule des taux numeriques et reset les echecs consecutifs", () => {
    recordParsingError();
    recordParsingError();
    expect(getAllMetrics().consecutiveFailures).toBe(2);

    recordSuccessfulExtraction();
    const rates = getErrorRates();
    expect(rates.totalCalls).toBe(3);
    expect(rates.errorRate).toBe(66.67);
    expect(rates.successRate).toBe(33.33);
    expect(rates.consecutiveFailures).toBe(0);
  });
});
