#!/bin/sh
# Deploy backend preprod sur le VPS. Refuse prod (cwd + nom de base).
set -eu
cd "$(dirname "$0")/.."
export APP_ENV=preprod

node --input-type=module <<'EOF'
import "./Config/env.js";
import {
  assertPreprodCwd,
  assertPreprodDatabaseName,
} from "./scripts/assertPreprodTarget.js";

assertPreprodCwd(process.cwd());
assertPreprodDatabaseName(process.env.DATABASE_URL);
if (process.env.DATABASE_URL_OWNER) {
  assertPreprodDatabaseName(process.env.DATABASE_URL_OWNER);
}
EOF

pnpm install --frozen-lockfile
pnpm db:migrate
pm2 restart mysmartfood-preprod --update-env
sleep 2
curl -fsS http://127.0.0.1:8081/api/health >/dev/null
echo "OK: backend preprod redeploye (8081)"
