# Monitoring backend

Observabilite du process Node : logs stdout, sondes publiques, snapshot admin, alertes en memoire.

## Sondes publiques (sans auth)

| Endpoint | Role | Codes |
|---|---|---|
| `GET /api/ping` | Process vivant + uptime | 200 |
| `GET /api/health` | Readiness MongoDB | 200 / 503 |
| `GET /api/status` | Runtime (env, uptime, heap, rss, etat DB) | 200 |

`/api/status` reste 200 si MongoDB est down (le champ `db` le signale). `/api/health` renvoie 503.

## Snapshot admin (JWT admin)

| Endpoint | Role |
|---|---|
| `GET /api/monitoring` | Etat global : process, HTTP, extraction, circuit breaker, streams, queue, alertes |
| `GET /api/monitoring/metrics` | Compteurs HTTP + extraction + circuit breaker |
| `GET /api/monitoring/alerts` | Dernieres alertes (`?limit=1-50`) |

Header : `Authorization: Bearer <token>`.

Les metriques HTTP, extraction et alertes sont **in-memory** : elles se reinitialisent au redemarrage.

## Signaux collectes

- Process : uptime, pid, heap, rss, lag event-loop
- HTTP : volume, 2xx/4xx/5xx, latence avg/p95/max (hors sondes `/ping` `/health` `/status`)
- Extraction GPT : succes, erreurs STT/parsing, telephones/heures invalides, echecs consecutifs
- OpenAI : etat du circuit breaker
- Runtime : streams media actifs, sockets notifications, taille de la queue transcription
- Persistance : extractions en echec sur 24 h (MongoDB)

## Alertes

`startAlertMonitoring()` tourne au demarrage (`server.js`), toutes les 60 s :

- taux d'erreur extraction > 5 %
- circuit breaker OPEN
- plus de 10 echecs d'extraction consecutifs

Canal actuel : logs structures + tampon des 50 dernieres alertes. Pas d'email / Slack.

## CLI local

```bash
cd backend
pnpm run monitor
```

Interroge `/api/health` et `/api/status` toutes les 5 s (`MONITOR_HOST`, `MONITOR_INTERVAL_MS` optionnels).

## Logs

Stdout/stderr uniquement (`Services/logging/logger.js`). Les secrets sont masques. Plus de fichiers Winston.

## Hors scope actuel

- CallMonitor / quota minutes : modele et routes existent, le cycle de vie appel n'est pas cable ici
- Routes orphelines `Routes/Auth/stats.js` et `maintenance.js` : non enregistrees, chiffres simules
- Gateway (`gateway.js`) : process separe, pas de healthcheck
- Prometheus / Sentry / Grafana : non integres
