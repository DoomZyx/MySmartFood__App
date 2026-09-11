import "../Config/env.js";
import crypto from "node:crypto";
import { connectDatabase, closeDatabase } from "../database/pool.js";
import * as User from "../models/pg/User.js";
import * as Tenant from "../models/pg/Tenant.js";
import * as Membership from "../models/pg/Membership.js";
import * as Plan from "../models/pg/Plan.js";
import * as Subscription from "../models/pg/Subscription.js";

/**
 * Compte admin local + tenant réel + abonnement développeur (sans plafond pratique).
 * Email : DEV_ADMIN_EMAIL (défaut axelcella.ac@gmail.com)
 * Mot de passe : DEV_ADMIN_PASSWORD, sinon généré une fois à la création.
 */
async function main() {
  const email = String(process.env.DEV_ADMIN_EMAIL || "axelcella.ac@gmail.com")
    .trim()
    .toLowerCase();
  const requestedPassword = process.env.DEV_ADMIN_PASSWORD
    ? String(process.env.DEV_ADMIN_PASSWORD).trim()
    : "";
  const tenantName = String(process.env.DEV_TENANT_NAME || "HandleHome").trim() || "HandleHome";

  await connectDatabase();

  const plan = await Plan.findBySlug("developpeur");
  if (!plan) {
    throw new Error("Plan developpeur absent. Lancer pnpm db:migrate");
  }

  let user = await User.findByEmail(email);
  if (!user && email !== "admin@handlehome.com") {
    const legacy = await User.findByEmail("admin@handlehome.com");
    if (legacy) {
      user = await User.updateEmail(legacy.id, email);
    }
  }
  let generatedPassword = null;
  if (!user) {
    const password = requestedPassword || crypto.randomBytes(12).toString("base64url");
    if (!requestedPassword) generatedPassword = password;
    if (password.length < 8) {
      throw new Error("DEV_ADMIN_PASSWORD doit contenir au moins 8 caractères");
    }
    user = await User.create({
      email,
      name: "Admin",
      password,
      emailVerified: true,
      isPlatformAdmin: true,
    });
  } else {
    await User.setPlatformAdmin(user.id, true);
    if (requestedPassword) {
      if (requestedPassword.length < 8) {
        throw new Error("DEV_ADMIN_PASSWORD doit contenir au moins 8 caractères");
      }
      await User.setPassword(user.id, requestedPassword);
    }
  }

  let tenant = await Tenant.findBySlug("handlehome");
  if (!tenant) {
    const created = await Tenant.createTenant(null, {
      slug: "handlehome",
      name: tenantName,
      ownerUserId: user.id,
      status: "active",
    });
    tenant = await Tenant.findById(created.id);
  }
  await Tenant.updateStatus(null, tenant.id, "active");
  await Membership.createMembership(null, {
    tenantId: tenant.id,
    userId: user.id,
    role: "owner",
  });

  const current = await Subscription.findCurrentByTenant(tenant.id);
  if (!current || !Subscription.isAccessGranted(current.status) || current.planId !== plan.id) {
    const periodEnd = new Date();
    periodEnd.setFullYear(periodEnd.getFullYear() + 10);
    await Subscription.createManual(null, {
      tenantId: tenant.id,
      planId: plan.id,
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
    });
  }

  await closeDatabase();

  const report = {
    email,
    tenantId: tenant.id,
    tenantSlug: "handlehome",
    tenantMap: `inst_default:${tenant.id}`,
    plan: "developpeur",
    password: generatedPassword ? generatedPassword : requestedPassword ? "(DEV_ADMIN_PASSWORD)" : "(inchangé)",
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const isDirect = process.argv[1] && process.argv[1].endsWith("provisionDevTenant.js");
if (isDirect) {
  main().catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  });
}

export { main };
