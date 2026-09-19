# Plateforme vocale et monitoring

Ce document décrit le chemin d'appel, le branchement d'un LLM vLLM distant et
les procédures de diagnostic. Il complète :

- `voice-server/ARCHITECTURE.md` pour le runtime Python ;
- `backend/MONITORING.md` pour le contrat de monitoring ;
- `infrastructure/scaleway-vllm/README.md` pour le nœud GPU (Voice Server + vLLM).

## Flux d'un appel

1. Twilio appelle le webhook Fastify.
2. Fastify génère le TwiML avec deux paramètres privés au flux :
   `callerNumber` et `instanceId`.
3. La route `/media-stream` sonde le Voice Server.
4. Si le Voice Server est prêt, Fastify proxifie le WebSocket vers Python.
5. Sinon, l'appel utilise OpenAI Realtime.
6. Le Voice Server exécute VAD, STT, LLM et TTS.
7. Le LLM appelle uniquement les outils Fastify ; il n'accède jamais à MongoDB.
8. Si vLLM échoue pendant un tour, OpenAI Chat Completions prend le relais.

Le fournisseur actif et la route sélectionnée sont visibles dans le monitoring.
La route monolithique et le Gateway utilisent le même routeur. Quand
`VOICE_SERVICE_URLS` contient plusieurs réplicas, seuls les réplicas prêts
participent à une sélection round-robin.

## Contexte métier

Le Voice Server lit `instanceId` dans l'événement `start` de Twilio, puis appelle
`GET /api/voice/context/:instanceId`. Cet endpoint :

- exige `x-api-key` ;
- charge les informations et le menu par `PricingService.getPricingForGPT` ;
- applique un **cache mémoire TTL 45s** invalidé sur écriture menu / horaires / amenities ;
- **compacte** le menu (nom + prix, descriptions courtes) pour le prompt ;
- ne renvoie aucun secret ;
- est la source unique du contexte restaurant pour le prompt Python.

Si le contexte est indisponible (timeout / menu vide), le Voice Server bascule en
**fail soft** : message d'excuse, outils désactivés, pas de prise de commande inventée.

Avant `create_appointment`, le dispatcher rappelle
`GET /api/voice/context/:instanceId/snapshot` pour revalider ouverture et produits
disponibles (anti-stale mid-call).

Les plages MIDI/SOIR du prompt sont dérivées de `horairesOuverture`, plus hardcodées.

Le numéro Twilio est normalisé et imposé aux arguments de
`create_appointment`. Le LLM ne peut pas le remplacer. Si Twilio fournit un
numéro masqué ou invalide, l'assistant le demande une seule fois.

## Configuration

Backend :

- `VOICE_HEALTH_URL` : `https://<VOICE_DOMAIN>/health` (Scaleway) ou `http://voice-server:8090/health` (local)
- `VOICE_WS_URL` : `wss://<VOICE_DOMAIN>/media-stream` ou `ws://voice-server:8090/media-stream`
- `VOICE_MONITORING_URL` : endpoint privé `/monitoring` du Voice Server ;
  dérivé automatiquement de `VOICE_HEALTH_URL` s’il est absent
- `VOICE_SERVICE_URLS` : bases HTTP séparées par des virgules ; cette option
  active le round-robin entre les réplicas prêts et remplace les deux variables
  précédentes
- `GATEWAY_HEALTH_URL` : facultatif, par exemple `http://gateway:3001/health`
- `X_API_KEY` : secret partagé avec le Voice Server
- `OPENAI_API_KEY` : requis tant que les fallbacks restent actifs

Voice Server :

- `NODE_BASE_URL` : URL publique Fastify (ngrok en local, domaine API en prod)
- `NODE_API_KEY` : même valeur que `X_API_KEY`
- `VLLM_BASE_URL` : `http://vllm:8000/v1` sur le nœud GPU (vLLM n'est pas public)
- `VLLM_MODEL` : identifiant exact renvoyé par `/v1/models` (`restaurant-assistant`)
- `VLLM_API_KEY` : secret dédié à vLLM, interne au Docker
- `LLM_FALLBACK_GPT=true`

Ne jamais placer ces secrets dans le frontend.

## Contrat de santé

Le Voice Server expose :

- `/live` pour la liveness ;
- `/ready` pour la readiness avec code 200 ou 503 ;
- `/health` pour le diagnostic sans identifiant d’appel ;
- `/monitoring` pour les sessions sanitizées, protégé par `x-api-key`.

Fastify agrège les données dans `GET /api/monitoring`, protégé par JWT admin.
Les statuts ont un sens stable :

- `healthy` : le service peut traiter le trafic ;
- `degraded` : un service vocal ou un fallback est indisponible ;
- `unhealthy` : la dépendance critique MongoDB est indisponible ;
- `disabled` : une sonde optionnelle n'est pas configurée ;
- `unknown` : aucune donnée exploitable n'a encore été reçue.

La page `/admin/services` actualise ce snapshot toutes les cinq secondes.

## Données visibles

Le dashboard présente :

- Backend, MongoDB, Gateway et Voice Server ;
- VAD, STT, LLM et TTS ;
- latence et dernière erreur par moteur ;
- fournisseur vLLM ou OpenAI ;
- appels actifs, route, étape et durée ;
- alertes backend récentes.

Les numéros, transcriptions, prompts, clés et réponses LLM ne sont jamais
retournés par le monitoring.

## Diagnostic

### Voice Server indisponible

1. Consulter la carte Voice Server et sa raison.
2. Vérifier `/live`, puis `/ready`.
3. Vérifier le processus Python et les dépendances système.
4. Confirmer que Fastify affiche la route `openai-realtime`.

### LLM vLLM indisponible

1. Vérifier la carte LLM et le fournisseur actif.
2. Tester `/v1/models` avec la clé vLLM.
3. Vérifier que `VLLM_MODEL` correspond exactement au modèle servi.
4. Consulter les journaux vLLM pour une saturation ou une erreur GPU.
5. Maintenir le fallback OpenAI jusqu'au retour à la normale.

### Latence élevée

1. Comparer les latences STT, LLM et TTS.
2. Si LLM domine, vérifier la file vLLM et `VLLM_MAX_NUM_SEQS`.
3. Si STT ou TTS domine, réduire la concurrence par réplica ou ajouter des
   réplicas Voice Server.
4. Rejouer le benchmark avec le même scénario avant tout changement.

### Création de commande impossible

1. Vérifier que `instanceId` est présent dans l'appel actif.
2. Vérifier `NODE_API_KEY` et l'endpoint de contexte vocal.
3. Vérifier l'étape `tool:create_appointment`.
4. Ne jamais contourner les validations Fastify depuis le Voice Server.

## Validation et déploiement

Ordre de validation :

1. tests Python du Voice Server ;
2. contrôles syntaxiques et tests ciblés backend ;
3. build frontend ;
4. appel Twilio réel avec menu et numéro automatiques ;
5. arrêt vLLM pour vérifier le fallback ;
6. test de 20 appels concurrents pendant 30 minutes ;
7. canary à 10 %, puis 50 %, puis 100 %.

La capacité supérieure à dix appels n'est pas certifiée tant que le test de
charge complet STT, LLM et TTS n'a pas réussi. Le benchmark fourni dans
`infrastructure/scaleway-vllm` mesure uniquement l'inférence LLM.

## Limites actuelles

- Le pipeline LLM et TTS ne diffuse pas encore les résultats en streaming.
- Les métriques sont en mémoire et repartent de zéro au redémarrage.
- Le compteur Gateway est local à chaque worker.
- Aucun GPU Scaleway n'est créé automatiquement par le dépôt.
- La topologie B expose le Voice Server, pas vLLM.
- OpenAI reste nécessaire pour les fallbacks et l'extraction post-appel.
