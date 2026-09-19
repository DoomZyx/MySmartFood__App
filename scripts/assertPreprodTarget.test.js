import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPreprodCwd,
  assertPreprodDatabaseName,
  databaseNameFromUrl,
} from "./assertPreprodTarget.js";

test("extrait le nom de base depuis une URL postgres", () => {
  assert.equal(
    databaseNameFromUrl(
      "postgres://mysmartfood_preprod_app:x@127.0.0.1:5432/mysmartfood_preprod"
    ),
    "mysmartfood_preprod"
  );
});

test("accepte uniquement la base preprod", () => {
  assert.doesNotThrow(() =>
    assertPreprodDatabaseName(
      "postgres://u:p@127.0.0.1:5432/mysmartfood_preprod"
    )
  );
  assert.throws(
    () => assertPreprodDatabaseName("postgres://u:p@127.0.0.1:5432/mysmartfood"),
    /preprod/
  );
});

test("refuse un cwd hors de l arbre preprod", () => {
  assert.doesNotThrow(() =>
    assertPreprodCwd("/home/deploy/apps/mysmartfood-preprod/backend")
  );
  assert.throws(
    () => assertPreprodCwd("/home/deploy/apps/mysmartfood/backend"),
    /preprod/
  );
});
