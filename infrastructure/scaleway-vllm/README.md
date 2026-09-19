# Realtime maison auto-hébergé sur Scaleway (topologie B)

Ce dossier déploie **Voice Server + vLLM** sur la même instance GPU.
Fastify et Twilio restent hors GPU : Fastify proxifie le Media Stream vers
le Voice Server public. vLLM n'est jamais exposé hors du réseau Docker.

Il ne crée aucune ressource Scaleway automatiquement.

## Architecture cible

- Une instance GPU Scaleway (L40S ou équivalent) héberge le realtime maison.
- vLLM sert `Qwen/Qwen2.5-3B-Instruct` sous l'alias `restaurant-assistant`.
- Le Voice Server exécute VAD, STT (Whisper CUDA), LLM (vLLM) et TTS.
- Caddy est le seul service exposé : FQDN `voice.mysmartfood.fr` en TLS sur
  `443`, et l’IP publique en HTTP sur `80` (fallback / ACME).
- Le cache Hugging Face doit être placé sur un Block Storage persistant.
- OpenAI reste le fallback tant que la capacité et la qualité ne sont pas validées.

Le modèle 3B est volontairement petit : latence et coût GPU d'abord.
Le remplacer par un 7B/8B uniquement si la qualité métier est insuffisante.

Pour la production, deux nœuds GPU derrière un load balancer sont nécessaires si
une panne d'instance ne doit pas interrompre le service. Le nombre réel de nœuds
doit être décidé à partir du benchmark, pas uniquement de la mémoire GPU.

## Préparation Scaleway

1. Créer une instance GPU dans une région proche du backend.
2. Attacher un Block Storage persistant monté sous `/srv/mysmartfood`.
3. Réserver une IP et faire pointer le domaine vocal vers cette IP.
4. Dans le Security Group, autoriser :
   - SSH uniquement depuis les adresses d'administration ;
   - HTTP/HTTPS pour le certificat (FQDN) ou HTTP:80 (IP seule) et le proxy Fastify ;
   - aucun accès public aux ports `8000` et `8090`.
5. Installer Docker, Docker Compose et NVIDIA Container Toolkit.
6. Vérifier que `nvidia-smi` fonctionne avant de démarrer la stack.

## Configuration

Copier `.env.example` vers `.env`, puis renseigner :

- `VOICE_DOMAIN` : FQDN public (`voice.mysmartfood.fr`) ;
- `VOICE_IP` : IP publique Scaleway (accès HTTP de secours) ;
- `ACME_EMAIL` ;
- `VLLM_API_KEY` : secret dédié vLLM, interne au Docker ;
- `NODE_BASE_URL` : URL publique Fastify (ngrok en local) ;
- `NODE_API_KEY` : même valeur que `X_API_KEY` du backend ;
- `OPENAI_API_KEY` : fallback LLM et fallback Fastify Realtime ;
- `HF_TOKEN` uniquement si le modèle exige une licence Hugging Face.

`Qwen/Qwen2.5-3B-Instruct` n'est pas gated. L'alias servi au Voice Server
doit rester `restaurant-assistant`.

## Démarrage

Depuis ce dossier, sur l'instance GPU :

```bash
docker compose config
docker compose pull
docker compose up -d --build
docker compose logs -f vllm voice
```

Vérifier ensuite le Voice Server, pas vLLM :

```bash
curl "https://$VOICE_DOMAIN/health"
```

`engines.ready` doit valoir `true`. Le modèle LLM actif est
`restaurant-assistant`.

Côté backend Fastify :

```dotenv
VOICE_PROVIDER=python
VOICE_HEALTH_URL=https://<VOICE_DOMAIN>/health
VOICE_WS_URL=wss://<VOICE_DOMAIN>/media-stream
```

`VOICE_PROVIDER` n'accepte que `python` ou `openai_realtime`.
La valeur `vllm` est rejetée et bascule sur OpenAI Realtime.

## Validation de capacité

Avant production :

1. exécuter des conversations représentatives avec tool-calling ;
2. tester au moins 20 sessions concurrentes pendant 30 minutes ;
3. mesurer p50/p95, erreurs HTTP, requêtes en attente et appels d'outil invalides ;
4. viser un p95 de réponse vocale inférieur à 3 secondes ;
5. vérifier le fallback OpenAI en arrêtant temporairement vLLM ;
6. augmenter les nœuds ou changer de modèle si la file d'attente monte.

`VLLM_MAX_NUM_SEQS` et `VLLM_GPU_MEMORY_UTILIZATION` augmentent le débit LLM
mais laissent moins de VRAM à Whisper. Toute modification doit être comparée
avec le même scénario de charge.

Le script fourni vérifie rapidement l'API vLLM et le tool-calling. Il doit
être lancé **depuis l'instance**, vers l'URL interne :

```bash
export VLLM_BASE_URL="http://127.0.0.1:8000/v1"
export VLLM_MODEL="restaurant-assistant"
export VLLM_API_KEY="<secret>"
python benchmark.py --concurrency 20 --requests 100
```

Ce benchmark ne couvre pas Twilio, Whisper ou Kokoro. Le test d'appel complet
reste obligatoire avant une bascule de trafic.

## Exploitation et rotation

- Une seule instance GPU pour prod, préprod et local (`voice.mysmartfood.fr`).
- `NODE_BASE_URL` décide quelle API reçoit les tools voix. Défaut : prod.
  Bascule manuelle sur le GPU :

```bash
cd /home/ubuntu/mysmartfood/infrastructure/scaleway-vllm
./set-node-target.sh preprod   # tools → preprod.api
./set-node-target.sh prod      # tools → app.api (remettre ensuite)
```

- Ne jamais committer `.env`, les clés IAM ou le token Hugging Face.
- Faire tourner `VLLM_API_KEY` côté vLLM puis côté Voice Server.
- Conserver le cache modèle sur Block Storage ; le stockage scratch est éphémère.
- Épingler l'image après chaque qualification.
- En cas d'incident, remettre `VOICE_PROVIDER=openai_realtime` en conservant
  les journaux et le snapshot `/api/monitoring` pour le diagnostic.
