import dotenv from "dotenv";

const APP_ENV_VALUES = new Set(["dev", "preprod", "prod"]);
const requestedAppEnv =
  process.env.APP_ENV ||
  (APP_ENV_VALUES.has(process.env.NODE_ENV) ? process.env.NODE_ENV : null) ||
  "dev";

if (!APP_ENV_VALUES.has(requestedAppEnv)) {
  throw new Error("APP_ENV doit valoir dev, preprod ou prod");
}

// Le fichier ciblé est prioritaire. `.env` reste un fallback local temporaire.
dotenv.config({
  path: [`.env.${requestedAppEnv}.local`, `.env.${requestedAppEnv}`, ".env"],
  quiet: true,
});

export const appEnv = requestedAppEnv;

// NODE_ENV conserve les valeurs comprises par Fastify et les dépendances.
if (!process.env.NODE_ENV || APP_ENV_VALUES.has(process.env.NODE_ENV)) {
  process.env.NODE_ENV = appEnv === "dev" ? "development" : "production";
}

export const config = {
  APP_ENV: appEnv,
  NODE_ENV: process.env.NODE_ENV,
  VOICE_PROVIDER: process.env.VOICE_PROVIDER || "python",
  Twilio_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  Twilio_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  Twilio_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  CORS_ORIGINS: process.env.CORS_ORIGINS,
  /** Identifiant d’instance Mongo (un déploiement = une valeur, souvent inst_default). */
  INSTANCE_ID: process.env.INSTANCE_ID,
  RESTAURANT_PHONE_NUMBER: process.env.RESTAURANT_PHONE_NUMBER,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  PUBLIC_HOST: process.env.PUBLIC_HOST,
  PORT: Number(process.env.PORT),
};
