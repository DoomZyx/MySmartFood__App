# Architecture globale MySmartFood

Ce document décrit **où tourne quoi**, et **qui parle à qui**.
Le stack VPS `apps/mysmartfood` est la **production** (Stripe live). La préprod est un second arbre : voir **Prod vs preprod**.
Le détail vocal est dans `docs/VOICE_PLATFORM.md` et `voice-server/ARCHITECTURE.md`.

## Idée simple

Trois rôles, trois endroits :

| Rôle | Où | Quoi |
|---|---|---|
| Métier | VPS OVH (`vps-35d353fb`, `54.37.231.243`) | Fastify, SPA, Postgres `mysmartfood` |
| Voix | GPU Scaleway (`51.159.149.110`) | Voice Server (FastAPI), vLLM, Whisper, TTS |

Le GPU **ne connaît pas** la base. Il appelle Fastify. Fastify **ne fait pas** la synthèse vocale. Nginx sur le VPS est le seul point d’entrée HTTPS du métier.

Mafrashop / WM Performance tournent **sur le même VPS**, dans d’autres dossiers et d’autres process PM2. Ce n’est pas MySmartFood.

## Schéma

```
  Navigateur                    Téléphone (Twilio)
       |                                |
       | HTTPS                          | webhook + Media Stream
       v                                v
  nginx :443  ---- /            Fastify :8080 (127.0.0.1)
  app.api.mysmartfood.fr              |
       |                    +---------+---------+
       | /                  |                   |
       | SPA (frontend/dist) |                   |
       |                    |                   v
       | /api /ws /media-stream           Postgres 127.0.0.1
       |                    |             base mysmartfood
       |                    |             (inaccessible d'Internet)
       |                    |
       |                    |  si Voice Server pret
       |                    v
       |              GPU Caddy :80
       |              Voice Server :8090
       |                 |
       |                 +-- vLLM (interne Docker, port 8000 ferme)
       |                 +-- outils HTTP vers Fastify
       |                      NODE_BASE_URL=https://app.api.mysmartfood.fr
```

## VPS métier (`deploy@54.37.231.243`)

DNS (zone OVH `mysmartfood.fr`) :

- **A** `app.api` → `54.37.231.243` (API + même SPA)
- **A** `www` → `54.37.231.243` (vitrine / dashboard)
- **A** `@` (`mysmartfood.fr`) → `54.37.231.243`
- **A** `dashboard` → `54.37.231.243` (même SPA)

| Piece | Emplacement | Isolation |
|---|---|---|
| Code | `/home/deploy/apps/mysmartfood/` | pas dans `apps/prod` ni `apps/preprod` |
| Process | PM2 `mysmartfood`, port **8080** | distinct de `prod` / `preprod` (3000+) |
| Front | `frontend/dist` servi par nginx | même hôte que l’API |
| API | `backend/`, `APP_ENV=preprod` | `PUBLIC_HOST=https://app.api.mysmartfood.fr` |
| Nginx | `sites-enabled/app.api.mysmartfood.fr` | `server_name` dédié, TLS Let’s Encrypt |
| Postgres | `127.0.0.1:5432`, database `mysmartfood` | rôles `mysmartfood_owner` / `mysmartfood_app` ; pas de GRANT sur les bases Mafrashop |

Nginx :

- `/` → fichiers du SPA
- `/api/`, `/ws/`, `/media-stream` → `http://127.0.0.1:8080`

Fastify n’écoute pas 0.0.0.0 publiquement de façon utile : le monde passe par nginx.

Variables importantes (fichier `backend/.env` **sur le VPS**, jamais dans git) :

- `DATABASE_URL` : rôle applicatif (sans BYPASSRLS)
- `DATABASE_URL_OWNER` : migrations / bootstrap uniquement
- `VOICE_PROVIDER=python`
- `VOICE_HEALTH_URL=http://51.159.149.110/health`
- `VOICE_WS_URL=ws://51.159.149.110/media-stream`
- `X_API_KEY` : même valeur que `NODE_API_KEY` sur le GPU

TLS Postgres : la base est en local. Le pool Fastify n’exige pas de certificat pour `127.0.0.1` (`backend/database/pool.js`). Un Postgres distant en production doit garder TLS.

## GPU voix (`51.159.149.110`)

Compose : `/home/ubuntu/mysmartfood/infrastructure/scaleway-vllm/`

| Service | Réseau | Public |
|---|---|---|
| `vllm` | Docker interne, `:8000` | non |
| `voice` | interne, `:8090` | non |
| `caddy` | `:80` | oui (Voice Server uniquement) |

vLLM sert le modèle sous l’alias `restaurant-assistant`. Le Voice Server fait VAD, STT, LLM, TTS. Il charge le menu / les résas via Fastify (`GET /api/voice/context/...`, outils).

`NODE_BASE_URL=https://app.api.mysmartfood.fr`

Santé : `http://51.159.149.110/health` — `engines.ready` et `components.node` doivent être sains.

## Flux d’un appel

1. Twilio frappe Fastify (URL publique `app.api`).
2. Fastify sonde le Voice Server.
3. Prêt → le Media Stream est proxifié vers le GPU. Sinon fallback OpenAI Realtime.
4. Sur le GPU : parole → texte → vLLM → outils Fastify si besoin → audio.
5. Fastify écrit dans Postgres. Le GPU n’a pas d’accès SQL.

## Ce qui n’est pas MySmartFood

| Machine / process | Projet |
|---|---|
| PM2 `prod`, `preprod` | Mafrashop / WM Performance |
| `www.mysmartfood.fr` (Vercel) | ancienne vitrine ; le SPA préprod VPS est sur `app.api` |
| `51.255.203.176` | ancienne IP de `app.api`, plus utilisée |

Ne pas déployer MySmartFood dans `/home/deploy/apps/prod`.

## Prod vs preprod

Le stack VPS décrit ci-dessus (`/home/deploy/apps/mysmartfood`, PM2 `mysmartfood`, port **8080**, base `mysmartfood`, hôtes `www` / `dashboard` / `app.api`) est la **production**, Stripe **live**.

La préprod MySmartFood est un **second arbre** sur le même VPS. Ne pas la confondre avec les process PM2 `prod` / `preprod` (Mafrashop / WM Performance).

| | Prod | Préprod MySmartFood |
|---|---|---|
| Arbre | `/home/deploy/apps/mysmartfood/` | `/home/deploy/apps/mysmartfood-preprod/` |
| PM2 | `mysmartfood` | `mysmartfood-preprod` |
| Port Fastify | **8080** | **8081** |
| Postgres | `mysmartfood` | `mysmartfood_preprod` |
| SPA | `https://www.mysmartfood.fr`, `https://dashboard.mysmartfood.fr` | `https://preprod.mysmartfood.fr` |
| API | `https://app.api.mysmartfood.fr` | `https://preprod.api.mysmartfood.fr` |
| Dist SPA | `.../mysmartfood/frontend/dist` | `.../mysmartfood-preprod/frontend/dist` |
| Build SPA | `pnpm build` (`VITE_*` → app.api) | `pnpm run build:preprod` |

Build préprod (depuis `frontend/` ; ne pas déployer ce `dist/` sur www / dashboard / app.api) :

```bash
cd frontend
pnpm run build:preprod
# equiv. : sh infrastructure/vps-nginx/build-preprod-frontend.sh
# VITE_API_BASE_URL=https://preprod.api.mysmartfood.fr
# VITE_API_URL=https://preprod.api.mysmartfood.fr/  (slash final : concat dashboard)
# copier dist/ vers /home/deploy/apps/mysmartfood-preprod/frontend/dist
```

### DNS et TLS (opérateur)

Zone OVH `mysmartfood.fr`, deux **A** vers le VPS `54.37.231.243` :

```
preprod      A  54.37.231.243
preprod.api  A  54.37.231.243
```

```bash
# Verifier la resolution (attendu : 54.37.231.243)
dig +short A preprod.mysmartfood.fr
dig +short A preprod.api.mysmartfood.fr

# Certificats (DNS deja resolu vers ce VPS)
sudo certbot --nginx -d preprod.mysmartfood.fr
sudo certbot --nginx -d preprod.api.mysmartfood.fr
```

## Local vs préprod

| | Laptop | Préprod |
|---|---|---|
| Front | `frontend/` Vite `:5174` | nginx + `dist/` |
| API | `pnpm dev` `:8080` | PM2 `:8080` derrière nginx |
| Postgres | Docker `pg-test` `:5433` | instance hôte, base `mysmartfood` |
| Voix | ngrok + GPU, ou OpenAI | GPU + `VOICE_PROVIDER=python` |

## Commandes utiles

VPS :

```bash
pm2 status
pm2 logs mysmartfood --lines 80
curl -sS https://app.api.mysmartfood.fr/api/ping
```

GPU :

```bash
cd /home/ubuntu/mysmartfood/infrastructure/scaleway-vllm
docker compose ps
curl -sS -H "Host: 51.159.149.110" http://127.0.0.1/health
```

Ne pas `pm2 restart prod` / `preprod` pour un souci MySmartFood.
