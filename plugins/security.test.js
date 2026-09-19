import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { resolveRateLimitMax } from "./security.js";

describe("resolveRateLimitMax", () => {
  test("en production le plafond global reste à 200", () => {
    assert.equal(resolveRateLimitMax({ NODE_ENV: "production" }), 200);
    assert.equal(resolveRateLimitMax({ APP_ENV: "prod" }), 200);
  });

  test("hors production le plafond global est plus haut pour le back-office", () => {
    assert.equal(resolveRateLimitMax({ NODE_ENV: "development", APP_ENV: "dev" }), 2000);
  });

  test("RATE_LIMIT_MAX force la valeur", () => {
    assert.equal(
      resolveRateLimitMax({ NODE_ENV: "production", RATE_LIMIT_MAX: "50" }),
      50
    );
  });
});
