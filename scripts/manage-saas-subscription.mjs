import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MODULE_KEYS = ["CLASS_MANAGEMENT", "GYM_ACCESS"];
const SUBSCRIPTION_STATUSES = ["TRIAL", "ACTIVE", "PAST_DUE", "GRACE", "SUSPENDED", "CANCELLED"];
const PLAN_SPECS = [
  {
    code: "CLASS",
    name: "Gestion arts martiaux",
    description: "Cours, groupes, planning et pointage.",
    modules: ["CLASS_MANAGEMENT"],
  },
  {
    code: "GYM",
    name: "Gestion salle",
    description: "Pass salle, contrôle d'accès et visites.",
    modules: ["GYM_ACCESS"],
  },
  {
    code: "HYBRID",
    name: "Gestion hybride",
    description: "Arts martiaux et accès salle dans un espace commun.",
    modules: ["CLASS_MANAGEMENT", "GYM_ACCESS"],
  },
];

function usage() {
  console.error(`Usage:
  npm run saas:control -- seed-plans --operator <identity> [--dry-run]
  npm run saas:control -- inspect --tenant <slug|id> --operator <identity>
  npm run saas:control -- assign --tenant <slug|id> --plan <CLASS|GYM|HYBRID> --status <status> --operator <identity> [dates] [--dry-run]
  npm run saas:control -- status --tenant <slug|id> --status <status> --operator <identity> [dates] [--dry-run]
  npm run saas:control -- rollback --audit-id <id> --operator <identity> [--dry-run]

Lifecycle options: --automatic-lifecycle <true|false>.
Date options: --starts-at, --trial-ends-at, --period-start, --period-end, --grace-ends-at.
Use --clear-trial-end, --clear-period-end or --clear-grace-end to remove an optional date.`);
}

function parseArguments(argv) {
  const [command, ...tokens] = argv;
  const options = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) throw new Error(`Argument inattendu: ${token}`);
    const key = token.slice(2);
    const next = tokens[index + 1];
    if (next && !next.startsWith("--")) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }
  return { command, options };
}

function requireString(options, key) {
  const value = options[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`--${key} est requis`);
  }
  return value.trim();
}

function parseDateOption(options, key) {
  const value = options[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`--${key} attend une date ISO`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Date invalide pour --${key}: ${value}`);
  return date;
}

function parseBooleanOption(options, key, fallback) {
  const value = options[key];
  if (value === undefined) return fallback;
  if (value === true || value === "true") return true;
  if (value === "false") return false;
  throw new Error(`--${key} attend true ou false`);
}

function iso(value) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

function json(value) {
  return JSON.stringify(value, null, 2);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sameState(left, right) {
  return stableStringify(left) === stableStringify(right);
}

async function findTenant(reference, client = prisma) {
  const tenant = await client.tenant.findFirst({
    where: { OR: [{ id: reference }, { slug: reference }] },
    select: { id: true, slug: true, name: true, status: true },
  });
  if (!tenant) throw new Error(`Tenant introuvable: ${reference}`);
  return tenant;
}

async function snapshotTenant(tenantId, client = prisma) {
  const [subscription, modules] = await Promise.all([
    client.tenantSaasSubscription.findFirst({
      where: { tenantId, isCurrent: true },
      orderBy: { createdAt: "desc" },
      include: { saasPlan: { select: { code: true, name: true } } },
    }),
    client.tenantModule.findMany({
      where: { tenantId },
      orderBy: { moduleKey: "asc" },
      select: {
        moduleKey: true,
        status: true,
        grantSource: true,
        saasSubscriptionId: true,
        enabledAt: true,
        disabledAt: true,
      },
    }),
  ]);

  return {
    currentSubscription: subscription
      ? {
          id: subscription.id,
          saasPlanId: subscription.saasPlanId,
          planCode: subscription.saasPlan.code,
          planName: subscription.saasPlan.name,
          status: subscription.status,
          automaticLifecycle: subscription.automaticLifecycle,
          isCurrent: subscription.isCurrent,
          startsAt: iso(subscription.startsAt),
          trialEndsAt: iso(subscription.trialEndsAt),
          currentPeriodStart: iso(subscription.currentPeriodStart),
          currentPeriodEnd: iso(subscription.currentPeriodEnd),
          graceEndsAt: iso(subscription.graceEndsAt),
          cancelledAt: iso(subscription.cancelledAt),
          operatorNote: subscription.operatorNote,
        }
      : null,
    modules: modules.map((module) => ({
      ...module,
      enabledAt: iso(module.enabledAt),
      disabledAt: iso(module.disabledAt),
    })),
  };
}

function dateOrNull(value) {
  return value ? new Date(value) : null;
}

function desiredDate(options, key, clearKey, fallback) {
  if (options[clearKey] === true) return null;
  const parsed = parseDateOption(options, key);
  return parsed === undefined ? fallback : parsed;
}

async function writeAudit(client, input) {
  return client.platformAuditLog.create({
    data: {
      tenantId: input.tenantId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      operatorIdentity: input.operator,
      beforeState: input.beforeState,
      afterState: input.afterState,
      metadata: input.metadata ?? undefined,
    },
  });
}

async function seedPlans(operator, dryRun) {
  const existingPlans = await prisma.saasPlan.findMany({
    where: { code: { in: PLAN_SPECS.map((plan) => plan.code) } },
    include: { modules: { orderBy: { moduleKey: "asc" } } },
    orderBy: { code: "asc" },
  });
  const before = existingPlans.map((plan) => ({
    code: plan.code,
    name: plan.name,
    priceCents: plan.priceCents,
    userLimit: plan.userLimit,
    memberLimit: plan.memberLimit,
    modules: plan.modules.map((entry) => entry.moduleKey),
  }));
  const existingByCode = new Map(existingPlans.map((plan) => [plan.code, plan]));
  const hasChanges = PLAN_SPECS.some((spec) => {
    const plan = existingByCode.get(spec.code);
    if (!plan) return true;
    return !sameState(plan.modules.map((entry) => entry.moduleKey), spec.modules);
  });

  const preview = PLAN_SPECS.map((spec) => ({ ...spec, priceCents: existingByCode.get(spec.code)?.priceCents ?? null }));
  if (!hasChanges) {
    console.log(json({ action: "seed-plans", changed: false, plans: preview }));
    return;
  }
  if (dryRun) {
    console.log(json({ action: "seed-plans", dryRun: true, before, after: preview }));
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    for (const spec of PLAN_SPECS) {
      const plan = await tx.saasPlan.upsert({
        where: { code: spec.code },
        create: {
          code: spec.code,
          name: spec.name,
          description: spec.description,
          priceCents: null,
          currency: "TND",
        },
        update: {},
      });
      await tx.saasPlanModule.deleteMany({
        where: { saasPlanId: plan.id, moduleKey: { notIn: spec.modules } },
      });
      for (const moduleKey of spec.modules) {
        await tx.saasPlanModule.upsert({
          where: { saasPlanId_moduleKey: { saasPlanId: plan.id, moduleKey } },
          create: { saasPlanId: plan.id, moduleKey },
          update: {},
        });
      }
    }
    const after = await tx.saasPlan.findMany({
      where: { code: { in: PLAN_SPECS.map((plan) => plan.code) } },
      include: { modules: { orderBy: { moduleKey: "asc" } } },
      orderBy: { code: "asc" },
    });
    const normalizedAfter = after.map((plan) => ({
      code: plan.code,
      name: plan.name,
      priceCents: plan.priceCents,
      userLimit: plan.userLimit,
      memberLimit: plan.memberLimit,
      modules: plan.modules.map((entry) => entry.moduleKey),
    }));
    const audit = await writeAudit(tx, {
      action: "SAAS_PLANS_SEEDED",
      entityType: "SaasPlanCatalog",
      operator,
      beforeState: before,
      afterState: normalizedAfter,
    });
    return { after: normalizedAfter, auditId: audit.id };
  });
  console.log(json({ action: "seed-plans", changed: true, ...result }));
}

async function inspectTenant(options, operator) {
  const tenant = await findTenant(requireString(options, "tenant"));
  const state = await snapshotTenant(tenant.id);
  console.log(json({ action: "inspect", operator, tenant, ...state }));
}

function subscriptionDates(options, current = null) {
  const now = new Date();
  const startsAt = parseDateOption(options, "starts-at") ?? dateOrNull(current?.startsAt) ?? now;
  return {
    startsAt,
    trialEndsAt: desiredDate(options, "trial-ends-at", "clear-trial-end", dateOrNull(current?.trialEndsAt)),
    currentPeriodStart:
      parseDateOption(options, "period-start") ?? dateOrNull(current?.currentPeriodStart) ?? startsAt,
    currentPeriodEnd: desiredDate(options, "period-end", "clear-period-end", dateOrNull(current?.currentPeriodEnd)),
    graceEndsAt: desiredDate(options, "grace-ends-at", "clear-grace-end", dateOrNull(current?.graceEndsAt)),
  };
}

async function reconcileModules(tx, tenantId, subscriptionId, enabledModules, previousModules) {
  const now = new Date();
  const previousByKey = new Map(previousModules.map((entry) => [entry.moduleKey, entry]));
  for (const moduleKey of MODULE_KEYS) {
    const enabled = enabledModules.includes(moduleKey);
    const previous = previousByKey.get(moduleKey);
    await tx.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey } },
      create: {
        tenantId,
        moduleKey,
        status: enabled ? "ENABLED" : "DISABLED",
        grantSource: "SAAS_SUBSCRIPTION",
        saasSubscriptionId: subscriptionId,
        enabledAt: enabled ? now : null,
        disabledAt: enabled ? null : now,
      },
      update: {
        status: enabled ? "ENABLED" : "DISABLED",
        grantSource: "SAAS_SUBSCRIPTION",
        saasSubscriptionId: subscriptionId,
        enabledAt: enabled ? dateOrNull(previous?.enabledAt) ?? now : previous?.enabledAt ? new Date(previous.enabledAt) : null,
        disabledAt: enabled ? null : dateOrNull(previous?.disabledAt) ?? now,
      },
    });
  }
}

async function assignSubscription(options, operator, dryRun) {
  const tenant = await findTenant(requireString(options, "tenant"));
  const planCode = requireString(options, "plan").toUpperCase();
  const status = requireString(options, "status").toUpperCase();
  if (!SUBSCRIPTION_STATUSES.includes(status)) throw new Error(`Statut invalide: ${status}`);
  const plan = await prisma.saasPlan.findUnique({
    where: { code: planCode },
    include: { modules: { orderBy: { moduleKey: "asc" } } },
  });
  if (!plan || !plan.isActive) throw new Error(`Plan SaaS actif introuvable: ${planCode}. Exécutez seed-plans.`);
  if (plan.modules.length === 0) throw new Error(`Le plan ${planCode} ne contient aucun module`);

  const before = await snapshotTenant(tenant.id);
  const samePlan = before.currentSubscription?.saasPlanId === plan.id;
  const dates = subscriptionDates(options, samePlan ? before.currentSubscription : null);
  const automaticLifecycle = parseBooleanOption(
    options,
    "automatic-lifecycle",
    samePlan ? before.currentSubscription?.automaticLifecycle ?? false : false,
  );
  const note = typeof options.note === "string" ? options.note.trim() || null : samePlan ? before.currentSubscription?.operatorNote ?? null : null;
  const desired = {
    planCode,
    status,
    automaticLifecycle,
    startsAt: iso(dates.startsAt),
    trialEndsAt: iso(dates.trialEndsAt),
    currentPeriodStart: iso(dates.currentPeriodStart),
    currentPeriodEnd: iso(dates.currentPeriodEnd),
    graceEndsAt: iso(dates.graceEndsAt),
    operatorNote: note,
    modules: MODULE_KEYS.map((moduleKey) => ({
      moduleKey,
      status: plan.modules.some((entry) => entry.moduleKey === moduleKey) ? "ENABLED" : "DISABLED",
    })),
  };
  const currentComparable = before.currentSubscription
    ? {
        planCode: before.currentSubscription.planCode,
        status: before.currentSubscription.status,
        automaticLifecycle: before.currentSubscription.automaticLifecycle,
        startsAt: before.currentSubscription.startsAt,
        trialEndsAt: before.currentSubscription.trialEndsAt,
        currentPeriodStart: before.currentSubscription.currentPeriodStart,
        currentPeriodEnd: before.currentSubscription.currentPeriodEnd,
        graceEndsAt: before.currentSubscription.graceEndsAt,
        operatorNote: before.currentSubscription.operatorNote,
        modules: MODULE_KEYS.map((moduleKey) => ({
          moduleKey,
          status: before.modules.find((entry) => entry.moduleKey === moduleKey)?.status ?? "DISABLED",
        })),
      }
    : null;
  const provenanceAligned = samePlan && before.modules.every(
    (module) =>
      module.grantSource === "SAAS_SUBSCRIPTION"
      && module.saasSubscriptionId === before.currentSubscription?.id,
  );
  if (sameState(currentComparable, desired) && provenanceAligned) {
    console.log(json({ action: "assign", changed: false, tenant, state: before }));
    return;
  }
  if (dryRun) {
    console.log(json({ action: "assign", dryRun: true, tenant, before, desired }));
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    let subscription;
    if (samePlan && before.currentSubscription) {
      subscription = await tx.tenantSaasSubscription.update({
        where: { id: before.currentSubscription.id },
        data: {
          status,
          automaticLifecycle,
          startsAt: dates.startsAt,
          trialEndsAt: dates.trialEndsAt,
          currentPeriodStart: dates.currentPeriodStart,
          currentPeriodEnd: dates.currentPeriodEnd,
          graceEndsAt: dates.graceEndsAt,
          cancelledAt: status === "CANCELLED" ? new Date() : null,
          operatorNote: note,
        },
      });
    } else {
      await tx.tenantSaasSubscription.updateMany({
        where: { tenantId: tenant.id, isCurrent: true },
        data: { isCurrent: false },
      });
      subscription = await tx.tenantSaasSubscription.create({
        data: {
          tenantId: tenant.id,
          saasPlanId: plan.id,
          status,
          automaticLifecycle,
          startsAt: dates.startsAt,
          trialEndsAt: dates.trialEndsAt,
          currentPeriodStart: dates.currentPeriodStart,
          currentPeriodEnd: dates.currentPeriodEnd,
          graceEndsAt: dates.graceEndsAt,
          cancelledAt: status === "CANCELLED" ? new Date() : null,
          operatorNote: note,
        },
      });
    }
    await reconcileModules(
      tx,
      tenant.id,
      subscription.id,
      plan.modules.map((entry) => entry.moduleKey),
      before.modules,
    );
    const after = await snapshotTenant(tenant.id, tx);
    const audit = await writeAudit(tx, {
      tenantId: tenant.id,
      action: "SAAS_SUBSCRIPTION_ASSIGNED",
      entityType: "TenantSaasSubscription",
      entityId: subscription.id,
      operator,
      beforeState: before,
      afterState: after,
      metadata: { tenantSlug: tenant.slug, planCode },
    });
    return { after, auditId: audit.id };
  });
  console.log(json({ action: "assign", changed: true, tenant, ...result }));
}

async function changeStatus(options, operator, dryRun) {
  const tenant = await findTenant(requireString(options, "tenant"));
  const status = requireString(options, "status").toUpperCase();
  if (!SUBSCRIPTION_STATUSES.includes(status)) throw new Error(`Statut invalide: ${status}`);
  const before = await snapshotTenant(tenant.id);
  if (!before.currentSubscription) throw new Error("Aucun abonnement SaaS courant pour ce tenant");
  const dates = subscriptionDates(options, before.currentSubscription);
  const automaticLifecycle = parseBooleanOption(
    options,
    "automatic-lifecycle",
    before.currentSubscription.automaticLifecycle,
  );
  const note = typeof options.note === "string" ? options.note.trim() || null : before.currentSubscription.operatorNote;
  const desired = {
    ...before.currentSubscription,
    status,
    automaticLifecycle,
    startsAt: iso(dates.startsAt),
    trialEndsAt: iso(dates.trialEndsAt),
    currentPeriodStart: iso(dates.currentPeriodStart),
    currentPeriodEnd: iso(dates.currentPeriodEnd),
    graceEndsAt: iso(dates.graceEndsAt),
    cancelledAt: status === "CANCELLED" ? before.currentSubscription.cancelledAt ?? "NOW" : null,
    operatorNote: note,
  };
  const currentComparable = { ...before.currentSubscription, cancelledAt: before.currentSubscription.cancelledAt };
  const noDateChange = ["automaticLifecycle", "startsAt", "trialEndsAt", "currentPeriodStart", "currentPeriodEnd", "graceEndsAt", "operatorNote"]
    .every((key) => desired[key] === currentComparable[key]);
  if (status === before.currentSubscription.status && noDateChange) {
    console.log(json({ action: "status", changed: false, tenant, state: before }));
    return;
  }
  if (dryRun) {
    console.log(json({ action: "status", dryRun: true, tenant, before, desired }));
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.tenantSaasSubscription.update({
      where: { id: before.currentSubscription.id },
      data: {
        status,
        automaticLifecycle,
        startsAt: dates.startsAt,
        trialEndsAt: dates.trialEndsAt,
        currentPeriodStart: dates.currentPeriodStart,
        currentPeriodEnd: dates.currentPeriodEnd,
        graceEndsAt: dates.graceEndsAt,
        cancelledAt: status === "CANCELLED" ? new Date() : null,
        operatorNote: note,
      },
    });
    const after = await snapshotTenant(tenant.id, tx);
    const audit = await writeAudit(tx, {
      tenantId: tenant.id,
      action: "SAAS_SUBSCRIPTION_STATUS_CHANGED",
      entityType: "TenantSaasSubscription",
      entityId: before.currentSubscription.id,
      operator,
      beforeState: before,
      afterState: after,
      metadata: { tenantSlug: tenant.slug, status },
    });
    return { after, auditId: audit.id };
  });
  console.log(json({ action: "status", changed: true, tenant, ...result }));
}

async function restoreSnapshot(tx, tenantId, snapshot) {
  await tx.tenantSaasSubscription.updateMany({
    where: { tenantId, isCurrent: true },
    data: { isCurrent: false },
  });
  if (snapshot.currentSubscription) {
    const subscription = snapshot.currentSubscription;
    await tx.tenantSaasSubscription.update({
      where: { id: subscription.id },
      data: {
        isCurrent: true,
        status: subscription.status,
        automaticLifecycle: subscription.automaticLifecycle ?? false,
        startsAt: new Date(subscription.startsAt),
        trialEndsAt: dateOrNull(subscription.trialEndsAt),
        currentPeriodStart: dateOrNull(subscription.currentPeriodStart),
        currentPeriodEnd: dateOrNull(subscription.currentPeriodEnd),
        graceEndsAt: dateOrNull(subscription.graceEndsAt),
        cancelledAt: dateOrNull(subscription.cancelledAt),
        operatorNote: subscription.operatorNote ?? null,
      },
    });
  }

  const snapshotKeys = snapshot.modules.map((entry) => entry.moduleKey);
  await tx.tenantModule.deleteMany({
    where: { tenantId, moduleKey: { notIn: snapshotKeys } },
  });
  for (const moduleGrant of snapshot.modules) {
    await tx.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey: moduleGrant.moduleKey } },
      create: {
        tenantId,
        moduleKey: moduleGrant.moduleKey,
        status: moduleGrant.status,
        grantSource: moduleGrant.grantSource,
        saasSubscriptionId: moduleGrant.saasSubscriptionId,
        enabledAt: dateOrNull(moduleGrant.enabledAt),
        disabledAt: dateOrNull(moduleGrant.disabledAt),
      },
      update: {
        status: moduleGrant.status,
        grantSource: moduleGrant.grantSource,
        saasSubscriptionId: moduleGrant.saasSubscriptionId,
        enabledAt: dateOrNull(moduleGrant.enabledAt),
        disabledAt: dateOrNull(moduleGrant.disabledAt),
      },
    });
  }
}

async function rollbackAudit(options, operator, dryRun) {
  const auditId = requireString(options, "audit-id");
  const target = await prisma.platformAuditLog.findUnique({ where: { id: auditId } });
  if (!target || !target.tenantId) throw new Error(`Audit SaaS de tenant introuvable: ${auditId}`);
  if (!["SAAS_SUBSCRIPTION_ASSIGNED", "SAAS_SUBSCRIPTION_STATUS_CHANGED"].includes(target.action)) {
    throw new Error(`L'action ${target.action} ne peut pas être restaurée par cette commande`);
  }
  const rollbackLogs = await prisma.platformAuditLog.findMany({
    where: { tenantId: target.tenantId, action: "SAAS_CONTROL_ROLLBACK" },
    select: { id: true, metadata: true },
  });
  const existingRollback = rollbackLogs.find((entry) => entry.metadata?.targetAuditId === auditId);
  if (existingRollback) {
    console.log(json({ action: "rollback", changed: false, auditId, rollbackAuditId: existingRollback.id }));
    return;
  }
  if (!target.beforeState || !target.afterState) throw new Error("L'audit ne contient pas les états de restauration");
  const tenant = await findTenant(target.tenantId);
  const current = await snapshotTenant(tenant.id);
  if (!sameState(current, target.afterState)) {
    throw new Error("État plus récent détecté : restaurez d'abord la dernière action SaaS de ce tenant");
  }
  if (dryRun) {
    console.log(json({ action: "rollback", dryRun: true, tenant, auditId, current, restore: target.beforeState }));
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    await restoreSnapshot(tx, tenant.id, target.beforeState);
    const after = await snapshotTenant(tenant.id, tx);
    const audit = await writeAudit(tx, {
      tenantId: tenant.id,
      action: "SAAS_CONTROL_ROLLBACK",
      entityType: target.entityType,
      entityId: target.entityId,
      operator,
      beforeState: current,
      afterState: after,
      metadata: { targetAuditId: auditId, targetAction: target.action },
    });
    return { after, rollbackAuditId: audit.id };
  });
  console.log(json({ action: "rollback", changed: true, tenant, auditId, ...result }));
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2));
  if (!command || options.help === true) {
    usage();
    process.exitCode = command ? 0 : 1;
    return;
  }
  const operator = requireString(options, "operator");
  if (operator.length < 3) throw new Error("--operator doit identifier clairement l'opérateur");
  const dryRun = options["dry-run"] === true;

  if (command === "seed-plans") return seedPlans(operator, dryRun);
  if (command === "inspect") return inspectTenant(options, operator);
  if (command === "assign") return assignSubscription(options, operator, dryRun);
  if (command === "status") return changeStatus(options, operator, dryRun);
  if (command === "rollback") return rollbackAudit(options, operator, dryRun);
  throw new Error(`Commande inconnue: ${command}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  usage();
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
