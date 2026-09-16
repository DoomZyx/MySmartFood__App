import "../Config/env.js";
import { connectDatabase, closeDatabase } from "../database/pool.js";
import { withTenant, withTransaction } from "../database/transaction.js";
import * as User from "../models/pg/User.js";
import * as Tenant from "../models/pg/Tenant.js";
import * as Membership from "../models/pg/Membership.js";
import * as Plan from "../models/pg/Plan.js";
import * as Subscription from "../models/pg/Subscription.js";
import { createProvisioningJob } from "../models/pg/ProvisioningJob.js";

const TEST_RESTOS = [
  {
    slug: "resto-test-a",
    name: "Resto Test A",
    email: "resto-test-a@mysmartfood.local",
  },
  {
    slug: "resto-test-b",
    name: "Resto Test B",
    email: "resto-test-b@mysmartfood.local",
  },
];

async function ensureResto(spec, plan) {
  let tenant = await Tenant.findBySlug(spec.slug);
  let user = await User.findByEmail(spec.email);
  if (!user) {
    user = await User.create({
      email: spec.email,
      name: spec.name,
      password: `Test-${spec.slug}-2026Aa`,
      emailVerified: true,
      isPlatformAdmin: false,
    });
  }

  if (!tenant) {
    let tenantId = null;
    await withTransaction(async (client) => {
      const created = await Tenant.createTenant(client, {
        slug: spec.slug,
        name: spec.name,
        ownerUserId: user.id,
        countryCode: "FR",
        status: "active",
      });
      tenantId = created.id;
      await Membership.createMembership(client, {
        tenantId,
        userId: user.id,
        role: "owner",
      });
      await createProvisioningJob(client, tenantId);
      const periodEnd = new Date();
      periodEnd.setFullYear(periodEnd.getFullYear() + 2);
      await Subscription.createManual(client, {
        tenantId,
        planId: plan.id,
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
      });
    });
    tenant = await Tenant.findById(tenantId);
  } else {
    await Tenant.updateStatus(null, tenant.id, "active");
    await Membership.createMembership(null, {
      tenantId: tenant.id,
      userId: user.id,
      role: "owner",
    });
  }

  await withTenant(tenant.id, (client) =>
    client.query(
      `INSERT INTO tenant_settings (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [tenant.id]
    )
  );

  return {
    slug: tenant.slug,
    tenantId: tenant.id,
    email: spec.email,
    voiceWebhookUrl: `/twilio/${tenant.slug}/incoming-call`,
  };
}

async function main() {
  await connectDatabase();
  const plan = (await Plan.findBySlug("beta")) || (await Plan.findBySlug("developpeur"));
  if (!plan) {
    throw new Error("Plan beta/developpeur absent. Lancer pnpm db:migrate");
  }
  const restos = [];
  for (const spec of TEST_RESTOS) {
    restos.push(await ensureResto(spec, plan));
  }
  await closeDatabase();
  process.stdout.write(`${JSON.stringify({ restos }, null, 2)}\n`);
}

const isDirect = process.argv[1] && process.argv[1].endsWith("provisionTestTenants.js");
if (isDirect) {
  main().catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  });
}

export { main, TEST_RESTOS };
