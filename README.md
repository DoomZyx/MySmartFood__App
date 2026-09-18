# MySmartFood

Un produit, un backend, un site.

La vitrine et le dashboard partagent la même SPA et la même API Fastify. L’ancien backend Express du site n’existe plus.

Architecture préprod (VPS + GPU + DNS) : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Voix et monitoring : [docs/VOICE_PLATFORM.md](docs/VOICE_PLATFORM.md).

## Stack local

| Piece | Dossier | Commande | Port |
|---|---|---|---|
| Site + dashboard | `frontend/` | `npm run dev` | 5174 |
| API | `backend/` | `pnpm dev` | 8080 |
| PostgreSQL | Docker `pg-test` | `sudo docker start pg-test` | 5433 |

La vitrine vit dans `frontend/src/site`, le dashboard dans `frontend/src/dashboard`, le commun dans `frontend/src/shared`. Un seul `npm run dev` dans `frontend/`.

Parcours web : vitrine → auth (email ou Google) → Stripe / abonnement → accès dashboard seulement si le compte est débloqué (`accessUnlocked` / admin). Sinon l’utilisateur reste sur `/mon-espace` ou `/onboarding`.

## Se connecter

1. Démarrer Postgres, puis le backend, puis le frontend.
2. Ouvrir `http://localhost:5174/login`.
3. Email / mot de passe, ou Google (`/api/auth/google?return=site`).
4. Le backend pose le cookie `smartcrm_token`, puis le site redirige vers :
   - le chemin dashboard si l’accès est débloqué
   - `/mon-espace` s’il y a un abonnement / une instance sans accès dashboard
   - `/onboarding` sinon

En local, `SITE_URL`, `FRONTEND_URL`, `DASHBOARD_URL` et `CORS_ORIGINS` pointent tous vers `http://localhost:5174`. L’API est `http://localhost:8080`.

## Scaler plus tard

Aujourd’hui un seul processus HTTP sert le site et le dashboard : `backend/` sur 8080.

Quand il faudra scaler la voix, lancer `pnpm run gateway` depuis `backend/` (processus séparé, pas un second backend auth). `TENANT_MAP` reste le shim mono-tenant jusqu’au sprint voix. Ne pas recréer une API d’authentification à côté.
