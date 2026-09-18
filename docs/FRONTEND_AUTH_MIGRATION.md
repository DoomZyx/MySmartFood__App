# Impact frontend : authentification cookie et suppression de la clé API tenant

Le backend unifié n'expose plus `GET /api/auth/tenant-key` et n'utilise plus `x-api-key` comme preuve d'identité. La session est un cookie HTTP-only. Ce document liste les points de rupture, sans modifier le frontend.

## Contrat d'API attendu

- `POST /api/auth/register` et `POST /api/auth/login` : body `{ email, password }`. Réponse `{ user, tenants }`. Le JWT n'est plus dans le JSON.
- `GET /api/auth/me` : cookie envoyé avec `credentials: "include"`.
- `POST /api/auth/logout` : efface le cookie.
- `GET /api/auth/google` puis callback. Si un compte e-mail existe déjà : redirection `google_link=required` + jeton, puis `POST /api/auth/google/confirm-link`.
- `GET /api/csrf-token` : `{ token }` à renvoyer en `x-csrf-token` sur les mutations authentifiées.
- `X-Tenant-Id` : sélecteur uniquement, vérifié contre `tenant_memberships`. Obligatoire si l'utilisateur a plusieurs établissements.
- `GET /api/checkout/plans`, `POST /api/checkout/create-session` `{ planSlug, countryCode }`.
- Métier isolé : `/api/tenant/orders`, `/api/tenant/reservations`, `/api/tenant/clients`.
- Onboarding : `/api/onboarding/profile`, `/api/onboarding/submit-dossier`.
- Plus d'endpoint `tenant-key`. Plus de clé API en `sessionStorage`.

## Fichiers impactés

| Fichier | Rupture |
|---|---|
| `frontend/src/API/apiKey.js` | `fetchTenantKeyFromWebsite` et `sessionStorage` deviennent inutiles et dangereux. |
| `frontend/src/API/auth.js` | Ne plus écrire `localStorage.token`. Utiliser `credentials: "include"`. Retirer `x-api-key` de `getAuthHeaders`. |
| `frontend/src/API/Pricing/api.js` | Tous les appels portent encore `x-api-key`. |
| `frontend/src/API/Appointment/api.js` | Idem. |
| `frontend/src/API/Calls/api.js` | Idem. |
| `frontend/src/API/PhoneLine/api.js` | Idem. |
| `frontend/src/API/Clients/api.js` | Idem. |
| `frontend/src/Services/monitoringService.js` | Idem. |
| `frontend/src/Services/notificationService.js` | WebSocket : authentifier par cookie, filtrer par tenant. |
| `frontend/src/Hooks/Profile/useProfile.js` | `localStorage.user` à remplacer par `/api/auth/me`. |
| `frontend/src/Services/securityService.js` | CSRF local à remplacer par `/api/csrf-token`. |
| `frontend/src/App.jsx` | Boot `tenant-key` / user site à retirer. |
| `frontend/src/i18n/config.js` | `localStorage.language` reste hors scope auth. |

## Adaptation minimale recommandée plus tard

1. Toutes les requêtes `fetch` : `credentials: "include"`.
2. AuthProvider React qui lit `/api/auth/me` et la liste `tenants`.
3. En-tête `X-Tenant-Id` choisi côté serveur après appartenance, jamais inventé.
4. WebSocket notifications : broadcast par tenant.

## Sécurité du WebSocket de notifications

Les routes `/ws/notifications` et `/api/ws/notifications` valident désormais, avant
l'upgrade WebSocket :

1. l'en-tête `Origin` avec la même liste d'origines autorisées que l'API ;
2. la session via le cookie HTTP-only `smartcrm_token`.

Une origine absente ou interdite reçoit un statut `403`. Une session absente,
expirée ou invalide reçoit un statut `401`. La connexion refusée n'est jamais
ajoutée au service de notifications.

Le filtrage des notifications par tenant reste nécessaire avant un déploiement
multi-tenant : l'authentification empêche l'accès anonyme, mais ne remplace pas
l'autorisation par établissement.
