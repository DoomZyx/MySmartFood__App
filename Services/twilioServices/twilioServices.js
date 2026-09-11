
import { normalizeCallerPhone } from "../../utils/callerPhone.js";

function escapeXmlAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeInstanceId(value) {
  if (value == null) return null;
  const normalized = String(value).trim();
  return /^[A-Za-z0-9_.:-]{1,128}$/.test(normalized) ? normalized : null;
}

/**
 * Génère le TwiML pour connecter l'appel au media stream.
 * VOICE_STREAM_URL (optionnel) : URL wss du Voice Service FastAPI. Sinon wss://{host}{streamPath}.
 * @param {string} host - Host du serveur (ex: gateway.example.com)
 * @param {string} [streamPath] - Chemin du stream WebSocket (défaut: /media-stream). Ex Gateway: /v1/inst_xxx/media-stream
 * @param {string|null} [callerNumber] - Numéro appelant fourni par Twilio
 * @param {string|null} [instanceId] - Instance métier associée à l'appel
 */
export function generateTwiml(
  host,
  streamPath = "/media-stream",
  callerNumber = null,
  instanceId = null,
) {
  const path = streamPath.startsWith("/") ? streamPath : `/${streamPath}`;
  const fromEnv =
    process.env.VOICE_STREAM_URL != null
      ? String(process.env.VOICE_STREAM_URL).trim()
      : "";
  const streamUrl = fromEnv || `wss://${host}${path}`;
  const escaped = escapeXmlAttribute(streamUrl);
  const normalizedCallerNumber = normalizeCallerPhone(callerNumber);
  const normalizedInstanceId = normalizeInstanceId(instanceId);
  const customParameters = [
    normalizedCallerNumber
      ? `<Parameter name="callerNumber" value="${escapeXmlAttribute(normalizedCallerNumber)}" />`
      : null,
    normalizedInstanceId
      ? `<Parameter name="instanceId" value="${escapeXmlAttribute(normalizedInstanceId)}" />`
      : null,
  ].filter(Boolean);
  const parametersXml =
    customParameters.length > 0
      ? `\n      ${customParameters.join("\n      ")}`
      : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
<Play>https://doomzyx.github.io/IntroVoice/VoiceIntro.mp3</Play>
  <Connect>
    <Stream url="${escaped}">${parametersXml}
    </Stream>
  </Connect>
</Response>`;
}

/**
 * TwiML pour refuser l'appel quand la ligne est désactivée (répondeur / occupé)
 */
export function generateTwimlLineDisabled() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Reject reason="busy" />
</Response>`;
}

/**
 * TwiML pour transférer l'appel vers le numéro du restaurant (ligne désactivée).
 * @param {string|null} phone - Numéro E.164 (ex: +33672886255). Si absent, renvoie Reject.
 */
export function generateTwimlTransferToRestaurant(phone) {
  const number = phone?.trim();
  if (!number) {
    return generateTwimlLineDisabled();
  }
  const escaped = number.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Number>${escaped}</Number>
  </Dial>
</Response>`;
}
