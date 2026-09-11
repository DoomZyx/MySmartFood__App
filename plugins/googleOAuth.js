import https from "node:https";
import { URL } from "node:url";
import oauthPlugin from "@fastify/oauth2";
import logger from "../Services/logging/logger.js";
import { loginWithGoogleProfile } from "../Business/services/AccountAuthService.js";
import { cookieOptions, setSessionCookie } from "../middleware/sessionAuth.js";
import { frontendUrlFromRequest, siteUrl } from "../utils/publicUrls.js";

const OAUTH_RETURN_COOKIE = "oauth_return";
const OAUTH_STATE_COOKIE = "oauth2-redirect-state";

function oauthCookieOpts() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  };
}

function readCookie(request, name) {
  const raw = request.cookies?.[name];
  if (!raw) return null;
  if (typeof request.unsignCookie === "function") {
    const unsigned = request.unsignCookie(raw);
    if (unsigned?.valid) return unsigned.value;
  }
  return raw;
}

function googleHttpsRequest({ method, urlString, headers = {}, body = null }) {
  const url = new URL(urlString);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method,
        family: 4,
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode || 0, data: data ? JSON.parse(data) : {} });
          } catch {
            reject(new Error("Réponse Google invalide"));
          }
        });
      }
    );
    req.on("error", (err) => {
      reject(new Error(err.message || "Connexion Google impossible"));
    });
    req.setTimeout(15000, () => {
      req.destroy(new Error("Timeout Google"));
    });
    if (body) req.write(body);
    req.end();
  });
}

async function exchangeGoogleCode(code) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    grant_type: "authorization_code",
  }).toString();
  const { status, data } = await googleHttpsRequest({
    method: "POST",
    urlString: "https://oauth2.googleapis.com/token",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body),
    },
    body,
  });
  if (status >= 400 || !data.access_token) {
    const detail = data.error_description || data.error || `HTTP ${status}`;
    throw new Error(`Échange Google: ${detail}`);
  }
  return data.access_token;
}

async function fetchGoogleProfile(accessToken) {
  const { status, data } = await googleHttpsRequest({
    method: "GET",
    urlString: "https://www.googleapis.com/oauth2/v2/userinfo",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (status >= 400) {
    throw new Error("Impossible de lire le profil Google");
  }
  return data;
}

export async function registerGoogleOAuth(fastify) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALLBACK_URL) {
    logger.warn("OAuth Google non configuré (GOOGLE_CLIENT_ID / SECRET / CALLBACK_URL)");
    return;
  }

  await fastify.register(oauthPlugin, {
    name: "googleOAuth2",
    scope: ["profile", "email"],
    credentials: {
      client: {
        id: process.env.GOOGLE_CLIENT_ID,
        secret: process.env.GOOGLE_CLIENT_SECRET,
      },
      auth: oauthPlugin.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: "/api/auth/google",
    callbackUri: process.env.GOOGLE_CALLBACK_URL,
    cookie: oauthCookieOpts(),
  });

  fastify.addHook("onRequest", async (request, reply) => {
    const url = request.raw?.url || request.url || "";
    if (url.startsWith("/api/auth/google") && !url.includes("callback")) {
      reply.setCookie(OAUTH_RETURN_COOKIE, frontendUrlFromRequest(request), {
        ...cookieOptions(),
        maxAge: 600,
      });
    }
  });

  fastify.get("/api/auth/google/callback", async (request, reply) => {
    const returnTo = readCookie(request, OAUTH_RETURN_COOKIE) || siteUrl();
    const fail = (reason) => {
      logger.error({ err: reason }, "Callback Google");
      const url = new URL("/login", returnTo);
      url.searchParams.set("error", "auth_failed");
      return reply.redirect(url.toString());
    };

    try {
      const code = request.query?.code;
      const state = request.query?.state;
      const expectedState = readCookie(request, OAUTH_STATE_COOKIE);
      if (!code) {
        return fail("Code Google manquant");
      }
      if (!state || !expectedState || state !== expectedState) {
        return fail("État OAuth invalide");
      }

      const accessToken = await exchangeGoogleCode(code);
      const profile = await fetchGoogleProfile(accessToken);
      const result = await loginWithGoogleProfile({
        googleId: profile.id,
        email: profile.email,
        emailVerified: profile.verified_email === true,
        name: profile.name,
        avatarUrl: profile.picture,
      });

      reply.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });
      reply.clearCookie(OAUTH_RETURN_COOKIE, { path: "/" });

      if (result.linkRequired) {
        const url = new URL("/login", returnTo);
        url.searchParams.set("google_link", "required");
        url.searchParams.set("token", result.linkToken);
        return reply.redirect(url.toString());
      }

      setSessionCookie(reply, result.user);
      return reply.redirect(`${returnTo}/api/auth/callback`);
    } catch (err) {
      return fail(err.message);
    }
  });
}
