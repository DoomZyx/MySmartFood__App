#!/bin/sh
# Build SPA preprod. Force VITE_API_* vers https://preprod.api.mysmartfood.fr
# Ne pas servir ce dist sur www / dashboard / app.api (prod).
# Cible nginx : /home/deploy/apps/mysmartfood-preprod/frontend/dist
set -e
cd "$(dirname "$0")/../../frontend"
pnpm run build:preprod
echo "OK: frontend/dist — copier vers /home/deploy/apps/mysmartfood-preprod/frontend/dist"
