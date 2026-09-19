#!/usr/bin/env bash
# Bascule NODE_BASE_URL du Voice Server (1 GPU partagé).
# Usage (sur l'instance GPU, depuis ce dossier) :
#   ./set-node-target.sh prod
#   ./set-node-target.sh preprod
set -euo pipefail

TARGET="${1:-}"
ENV_FILE="$(cd "$(dirname "$0")" && pwd)/.env"

case "$TARGET" in
  prod)
    URL="https://app.api.mysmartfood.fr"
    ;;
  preprod)
    URL="https://preprod.api.mysmartfood.fr"
    ;;
  *)
    echo "Usage: $0 prod|preprod" >&2
    exit 1
    ;;
esac

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

if grep -q '^NODE_BASE_URL=' "$ENV_FILE"; then
  sed -i "s|^NODE_BASE_URL=.*|NODE_BASE_URL=${URL}|" "$ENV_FILE"
else
  echo "NODE_BASE_URL=${URL}" >> "$ENV_FILE"
fi

echo "NODE_BASE_URL -> ${URL}"
docker compose up -d voice --force-recreate
docker compose ps voice
curl -sS -m 10 "https://voice.mysmartfood.fr/health" | head -c 200
echo
