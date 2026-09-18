# Passation : authentification MySmartFood

Document pour qu’un autre développeur puisse intervenir sans tout relire.
Audit produit détaillé (canvas) : ouvrir `auth-product-audit.canvas.tsx` dans le projet Cursor.

Contexte métier : SPA unique (vitrine + dashboard) + API Fastify. Session = cookie HttpOnly `smartcrm_token`. Plus de JWT dans le JSON de login. Le front n’est **pas** encore aligné sur ce contrat (deux clients, deux localStorage, ancienne clé API).

Prod actuelle (VPS `54.37.231.243`) :

| Hôte | Rôle |
|---|---|
| `https://www.mysmartfood.fr` | vitrine |
| `https://dashboard.mysmartfood.fr` | même SPA |
| `https://app.api.mysmartfood.fr` | API + callback Google Cloud Console |

Nginx proxyfie `/api/`, `/ws/`, `/twilio/`, `/v1/`, `/media-stream` vers Fastify `:8080`. Tout chemin SPA sous `/api/...` est donc **avalé par l’API**, pas par React.

Ne pas toucher Mafrashop (PM2 `prod` / `preprod`). Ne pas modifier le CSS existant sauf si le lot le demande explicitement.

---

## Symptôme utilisateur

Pas de modale / toast « connexion réussie ». Après Google, l’utilisateur peut voir un échec alors que le cookie est déjà posé.

Cause principale : collision d’URL `/api/auth/callback`.

1. Google Cloud Console → `GOOGLE_CALLBACK_URL` = `https://app.api.mysmartfood.fr/api/auth/google/callback`
2. Fastify pose le cookie, puis redirige vers `{SITE_URL}/api/auth/callback`
3. Sur `www`, nginx envoie `/api/*` à Fastify
4. Fastify traite ce GET comme **alias du callback Google** (sans `code`) → redirect `/login?error=auth_failed`
5. `LoginRedirect` ouvre la modale et va sur `/`, **en jetant** `error` et `google_link`

La page React `AuthCallback` n’est jamais rendue en prod sur www.

---

## Lots d’intervention (ordre)

### Lot 1 — Retour de session (P0)

Objectif : Google et e-mail ont un retour clair. Plus de collision `/api`.

- Callback front **hors** `/api`, ex. `/auth/callback`
- Backend : ne plus enregistrer `GET /api/auth/callback` comme handler Google ; garder uniquement `/api/auth/google/callback`
- Redirect succès : `{siteUrl}/auth/callback` (pas `/api/auth/callback`)
- `LoginRedirect` : afficher `error=auth_failed`, ne pas perdre `planId` / `from`
- Après login e-mail : feedback succès (toast existant ou étape dans la modale) **avant** ou pendant la redirection

### Lot 2 — Une session, une porte dashboard (P1)

Objectif : un seul `GET /api/auth/me` pilote vitrine et dashboard.

- Un AuthProvider
- Une clé localStorage (ou plus de user en localStorage, seulement dérivé de `/me`)
- Retirer `x-api-key` / `getToken()` / `localStorage.token`
- Une seule règle d’accès app : `accessUnlocked` / `dashboardUnlockedAt` / platform admin  
  Aujourd’hui `sessionPayload` met `role=admin` dès qu’il y a un tenant, et `hasDashboardAccess` accepte ce rôle → le mail `/access` n’est plus la source de vérité

### Lot 3 — Récupération compte (P1)

- Mot de passe oublié (inexistant)
- Trancher : vérifier l’e-mail à l’inscription, **ou** supprimer `emailVerified` (champ mort)
- Page `/access` : état succès, pas seulement redirect silencieux
- Google : soit confirmer le lien de compte (contrat dans `FRONTEND_AUTH_MIGRATION.md`), soit documenter le lien automatique actuel (`linkRequired` n’est jamais `true`)

Hors scope sauf demande : 2FA restaurateur, passkeys, refonte CSS, multi-établissements UI.

---

## Carte des fichiers

Chemins depuis la racine du dépôt `MySmartFood__App`.

### Backend — contrat session et Google

| Fichier | Rôle | Pourquoi intervenir |
|---|---|---|
| [backend/plugins/googleOAuth.js](../backend/plugins/googleOAuth.js) | OAuth Google, cookies `oauth_return` / state, redirect post-login | **Ligne ~215** : `redirect(\`${returnTo}/api/auth/callback\`)`. **Lignes ~221–223** : alias `GET /api/auth/callback` = handler Google (collision). |
| [backend/Routes/Auth/accountAuth.js](../backend/Routes/Auth/accountAuth.js) | Routes cookie : register, login, me, logout, redeem-access, set-password, confirm-link | Point d’entrée unique auth compte. Rate limit 10/min. Pas de forgot-password. CSRF non posé ici. |
| [backend/API/controllers/AccountAuthController.js](../backend/API/controllers/AccountAuthController.js) | Pose / efface le cookie, `sessionPayload` | Login/register = 200/201 + cookie. Logout = 204. |
| [backend/Business/services/AccountAuthService.js](../backend/Business/services/AccountAuthService.js) | register, login, Google, `sessionPayload` | Register : `emailVerified: false` jamais contrôlé ensuite. Google : lien auto du compte e-mail (`linkRequired: false` toujours). **~164** : `role: admin` si platform admin **ou** premier tenant. |
| [backend/middleware/sessionAuth.js](../backend/middleware/sessionAuth.js) | Cookie `smartcrm_token`, JWT 7j, `requireAuth` | HttpOnly, SameSite lax, `COOKIE_DOMAIN`. Accepte encore `Authorization: Bearer`. Logout n’invalide pas le JWT, seulement le cookie. |
| [backend/plugins/security.js](../backend/plugins/security.js) | Helmet, cookie, rate limit global, CSRF `_csrf` | CSRF utilisé sur contact / demo / onboarding / platform, **pas** sur login/register/logout. |
| [backend/Routes/Csrf/csrf.js](../backend/Routes/Csrf/csrf.js) | `GET /api/csrf-token` | Déjà consommé par l’admin plateforme et une partie site. |
| [backend/Business/services/DashboardAccessService.js](../backend/Business/services/DashboardAccessService.js) | Jeton d’accès dashboard + e-mail | URL `{site}/access?token=...`. Émis après paiement Stripe. Resend exige un abonnement actif. |
| [backend/Business/services/StripeBillingService.js](../backend/Business/services/StripeBillingService.js) | Appelle `issueDashboardAccessToken` après paiement | ~266. Ne pas casser le lien paiement → mail. |
| [backend/utils/publicUrls.js](../backend/utils/publicUrls.js) | `siteUrl()`, `dashboardUrl()`, `frontendUrlFromRequest()` | `return=site` → SITE_URL (www). Utilisé pour le redirect Google. |
| [backend/utils/emailService.js](../backend/utils/emailService.js) | Mail jeton dashboard | En prod seulement si `APP_ENV=prod`. |
| [backend/models/pg/User.js](../backend/models/pg/User.js) | users, google_id chiffré, `dashboardUnlockedAt` | `markDashboardUnlocked`, `setPassword`, `publicUser`. |
| [backend/app.js](../backend/app.js) | Montage : Google, CSRF, `/api/auth` → accountAuth | ~197–249. Ne pas remonter l’ancien `Routes/Auth/auth.js` pour login. |
| [backend/Routes/Auth/auth.js](../backend/Routes/Auth/auth.js) | Ancien profil / users (JWT header, ids Mongo 24 chars) | **Mort pour login**. Risque si quelqu’un le rebranche. |
| [backend/API/controllers/AuthController.js](../backend/API/controllers/AuthController.js) | Ancien login qui renvoyait `{ user, token }` | Ne plus utiliser. |
| [backend/Business/services/AuthService.js](../backend/Business/services/AuthService.js) | Ancien service JWT | Ne plus utiliser. |
| [backend/middleware/auth.js](../backend/middleware/auth.js) | `authenticateToken` legacy | Encore référencé par `Routes/Auth/auth.js`. |

### Frontend — deux clients sur la même SPA

| Fichier | Rôle | Pourquoi intervenir |
|---|---|---|
| [frontend/src/App.jsx](../frontend/src/App.jsx) | Routes unifiées | `/login` → LoginRedirect. **`/api/auth/callback` → AuthCallback** (injoignable derrière nginx). Dashboard protégé par `hasDashboardAccess`. |
| [frontend/src/site/App.jsx](../frontend/src/site/App.jsx) | `LoginRedirect`, `GoogleStartRedirect`, `GoogleCallbackRedirect`, layout + providers | **LoginRedirect ~77–94** : `navigate("/")` drop `?error=` et `google_link`. À corriger au lot 1. |
| [frontend/src/site/pages/AuthCallback.jsx](../frontend/src/site/pages/AuthCallback.jsx) | Retour OAuth prévu : `GET /api/auth/me` puis redirect | Déplacer la route vers `/auth/callback`. Pas de message succès. |
| [frontend/src/site/components/Shared/LoginModal/LoginModal.jsx](../frontend/src/site/components/Shared/LoginModal/LoginModal.jsx) | Login / register e-mail + bouton Google | **`finishAuth` ~36–54** : close + redirect, zéro succès. Google = `window.location` vers l’API. |
| [frontend/src/site/components/Shared/NotificationToast/NotificationToast.jsx](../frontend/src/site/components/Shared/NotificationToast/NotificationToast.jsx) | Toast succès déjà stylé | Non branché sur l’auth. Réutiliser plutôt que recréer. |
| [frontend/src/site/contexts/LoginModalContext.jsx](../frontend/src/site/contexts/LoginModalContext.jsx) | Ouverture modale + `loginIntent` (planId, from) | Intent perdu si LoginRedirect ne le transmet plus après fix query. |
| [frontend/src/site/contexts/AuthContext.jsx](../frontend/src/site/contexts/AuthContext.jsx) | Session vitrine, `smartcrm_user` | Boot via `getCurrentUser()`. Double stockage avec le dashboard. |
| [frontend/src/site/services/authService.js](../frontend/src/site/services/authService.js) | fetch register/login/me/logout, `credentials: include` | Client vitrine. Commentaire encore « placeholder backend ». |
| [frontend/src/site/services/apiBase.js](../frontend/src/site/services/apiBase.js) | `VITE_API_BASE_URL` / `VITE_API_URL` | Prod : `https://app.api.mysmartfood.fr`. |
| [frontend/src/shared/apiBase.js](../frontend/src/shared/apiBase.js) | Même chose, partagé | Source de vérité à préférer. |
| [frontend/src/shared/syncDashboardSession.js](../frontend/src/shared/syncDashboardSession.js) | Copie user → `localStorage.user` + `canOpenDashboard` | Porte vitrine : unlocked / platform admin **seulement**. |
| [frontend/src/site/services/syncDashboardSession.js](../frontend/src/site/services/syncDashboardSession.js) | Re-export shared | Imports LoginModal / AuthCallback / MonEspace. |
| [frontend/src/dashboard/API/auth.js](../frontend/src/dashboard/API/auth.js) | Second client : login, me, redeem, `hasDashboardAccess`, `getToken` | **`hasDashboardAccess` ~115** : true si `role === "admin"`. `isAuthenticated` = e-mail en localStorage. |
| [frontend/src/dashboard/API/http.js](../frontend/src/dashboard/API/http.js) | `apiFetch` + `persistSession` + `x-api-key` | Envoie encore `x-api-key` si `getApiKey()`. |
| [frontend/src/dashboard/API/apiKey.js](../frontend/src/dashboard/API/apiKey.js) | `VITE_API_KEY` / sessionStorage | Contrat mort (`tenant-key` supprimé). À retirer au lot 2. |
| [frontend/src/dashboard/Hooks/Login/useLogin.js](../frontend/src/dashboard/Hooks/Login/useLogin.js) | Ancien formulaire dashboard, gère `error=auth_failed` | **Non monté** dans `App.jsx` unifié. Ne pas « réparer » cette page : brancher le message sur LoginRedirect / LoginModal. |
| [frontend/src/dashboard/Pages/Login/Login.jsx](../frontend/src/dashboard/Pages/Login/Login.jsx) | UI login dashboard | Morte dans le routeur actuel. |
| [frontend/src/dashboard/utils/postAuthPath.js](../frontend/src/dashboard/utils/postAuthPath.js) | Destination après login dashboard | Utilise `hasDashboardAccess` (porte B). |
| [frontend/src/dashboard/Pages/Site/Access.jsx](../frontend/src/dashboard/Pages/Site/Access.jsx) | `/access?token=` | Page minimale. Succès = `openDashboard`, pas de confirmation. |
| [frontend/src/dashboard/Hooks/Site/useAccessRedeem.js](../frontend/src/dashboard/Hooks/Site/useAccessRedeem.js) | Redeem + redirect | Lot 3 : état succès. |
| [frontend/src/site/pages/MonEspace.jsx](../frontend/src/site/pages/MonEspace.jsx) | Espace compte, renvoi du lien d’accès | Texte produit « e-mail après paiement ». |
| [frontend/src/site/pages/Onboarding.jsx](../frontend/src/site/pages/Onboarding.jsx) | Onboarding si pas d’instance | Enchaînement register → onboarding. |
| [frontend/src/site/components/Auth/ProtectedRoute.jsx](../frontend/src/site/components/Auth/ProtectedRoute.jsx) | Garde vitrine → `/login` | |
| [frontend/src/shared/dashboardPath.js](../frontend/src/shared/dashboardPath.js) | `DASHBOARD_PATH`, `openDashboard` | Prod : peut sauter sur `dashboard.mysmartfood.fr`. |
| [infrastructure/vps-nginx/snippets/mysmartfood-spa.conf](../infrastructure/vps-nginx/snippets/mysmartfood-spa.conf) | `location /api/` → 127.0.0.1:8080 | Explique pourquoi `/api/auth/callback` n’atteint jamais React. Ne pas « exception nginx » si on peut déplacer la route SPA. |

### Docs déjà là

| Fichier | Contenu |
|---|---|
| [docs/FRONTEND_AUTH_MIGRATION.md](FRONTEND_AUTH_MIGRATION.md) | Contrat cible (cookie, CSRF, plus de tenant-key). **Décalé** : le front dashboard envoie encore `x-api-key` ; Google `confirm-link` n’est pas le chemin réel. |
| [docs/ARCHITECTURE.md](ARCHITECTURE.md) | VPS, DNS, nginx, PM2 `mysmartfood`. |
| [docs/VOICE_PLATFORM.md](VOICE_PLATFORM.md) | Hors auth. |

---

## Deux portes dashboard (à unifier au lot 2)

| Fonction | Fichier | Règle |
|---|---|---|
| `canOpenDashboard` | `frontend/src/shared/syncDashboardSession.js` | platform admin **ou** `accessUnlocked` / `dashboardUnlockedAt` |
| `hasDashboardAccess` | `frontend/src/dashboard/API/auth.js` | idem **ou** `role === "admin"` / `owner` |
| `sessionPayload.user.role` | `backend/Business/services/AccountAuthService.js` | `"admin"` si platform admin **ou** membership tenant |

Dès qu’un resto a un établissement, le backend le marque admin → le dashboard peut s’ouvrir **sans** le mail `/access`. La vitrine, elle, reste sur `canOpenDashboard`. C’est volontairement incohérent aujourd’hui, pas un détail.

---

## Variables (ne pas committer les secrets)

Côté API (fichier `.env` **sur le VPS**, pas git) :

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` (doit rester `https://app.api.mysmartfood.fr/api/auth/google/callback`)
- `SITE_URL` = `https://www.mysmartfood.fr`
- `DASHBOARD_URL` = `https://dashboard.mysmartfood.fr`
- `COOKIE_DOMAIN` = `.mysmartfood.fr` (sinon cookie host-only `app.api`)
- `JWT_SECRET`, `COOKIE_SECRET`
- `CORS_ORIGINS` (www + dashboard + éventuellement app.api)

Côté SPA (build) :

- `VITE_API_URL` / `VITE_API_BASE_URL` = `https://app.api.mysmartfood.fr`
- `VITE_DASHBOARD_URL` = `https://dashboard.mysmartfood.fr`
- Ne pas remettre `VITE_API_KEY` dans le bundle prod

Google Cloud Console : Authorized redirect = **uniquement**  
`https://app.api.mysmartfood.fr/api/auth/google/callback`  
Pas `www.../api/auth/callback`.

---

## Vérifs après patch

1. Login e-mail sur https://www.mysmartfood.fr : message succès (ou état clair), cookie posé, `GET /api/auth/me` = 200 depuis www (CORS + credentials).
2. Login Google : une seule redirection, atterrit sur la **SPA** `/auth/callback` (HTML React, pas JSON Fastify), puis dashboard ou `/mon-espace` / `/onboarding`.
3. `GET https://www.mysmartfood.fr/api/auth/callback` **sans** query Google ne doit plus lancer le handler OAuth (404 API ou page SPA selon le lot).
4. Compte sans `accessUnlocked` : vitrine **et** dashboard refusent l’app (même règle).
5. `/login?error=auth_failed` : message visible, pas une homepage muette.
6. Logout : cookie parti, les deux localStorage vides, `/api/auth/me` = 401.

Logs utiles VPS : `pm2 logs mysmartfood --lines 80` (chercher `Callback Google` / `Code Google manquant`).

---

## Ce qui est déjà correct (ne pas « améliorer »)

- Cookie HttpOnly, pas de JWT dans le body login
- Message login « Identifiants incorrects » identique (pas d’énumération MDP)
- Rate limit dédié login/register
- Admin plateforme (cookie pending + TOTP) séparé du login resto
- WebSocket notifications : Origin + cookie (voir `FRONTEND_AUTH_MIGRATION.md`)

---

## Branche git

Frontend : `frontend-production` (remote `DoomZyx/MySmartFood__App`).  
Backend : `backend-production` (même remote, autre working tree).  
Le dossier parent `MySmartFood__App` n’est pas le remote GitHub.
