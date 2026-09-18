/**
 * PM2 preprod uniquement. Ne pas start ceci a la place de `mysmartfood` (prod :8080).
 *
 * Sur le VPS :
 *   pm2 start /home/deploy/apps/mysmartfood-preprod/infrastructure/ecosystem-mysmartfood-preprod.cjs
 *   pm2 save
 *
 * Secrets : uniquement dans backend/.env / .env.preprod (pas ici).
 * COOKIE_DOMAIN vide = cookie host-only. Jamais .mysmartfood.fr.
 * PORT ici ecrase un PORT=8080 eventuel dans le .env (dotenv ne surcharge pas l existant).
 */
module.exports = {
  apps: [
    {
      name: "mysmartfood-preprod",
      cwd: "/home/deploy/apps/mysmartfood-preprod/backend",
      script: "server.js",
      interpreter: "node",
      env: {
        APP_ENV: "preprod",
        NODE_ENV: "production",
        PORT: "8081",
        COOKIE_DOMAIN: "",
      },
    },
  ],
};
