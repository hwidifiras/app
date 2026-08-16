import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DAY_MS = 24 * 60 * 60 * 1_000;

function usage() {
  console.error(`Usage:
  npm run signup:prune -- --operator <identity> [--apply]
    [--incomplete-days <7-365>] [--completed-days <30-730>] [--handoff-days <1-90>]

The command is a dry-run unless --apply is supplied. It removes signup workflow
records only; tenants, users, subscriptions, payments and club data are never
deleted.`);
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }
  return options;
}

function requiredString(options, key) {
  const value = options[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`--${key} is required`);
  return value.trim();
}

function boundedInteger(options, key, fallback, min, max) {
  const value = options[key];
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error(`--${key} must be an integer`);
  const parsed = Number.parseInt(value, 10);
  if (parsed < min || parsed > max) throw new Error(`--${key} must be between ${min} and ${max}`);
  return parsed;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help === true) {
    usage();
    return;
  }
  const operator = requiredString(options, "operator");
  if (operator.length < 3) throw new Error("--operator must clearly identify the operator");

  const incompleteDays = boundedInteger(options, "incomplete-days", 30, 7, 365);
  const completedDays = boundedInteger(options, "completed-days", 90, 30, 730);
  const handoffDays = boundedInteger(options, "handoff-days", 7, 1, 90);
  const now = new Date();
  const incompleteCutoff = new Date(now.getTime() - incompleteDays * DAY_MS);
  const completedCutoff = new Date(now.getTime() - completedDays * DAY_MS);
  const handoffCutoff = new Date(now.getTime() - handoffDays * DAY_MS);
  const signupWhere = {
    OR: [
      {
        status: { not: "COMPLETED" },
        expiresAt: { lt: incompleteCutoff },
      },
      {
        status: "COMPLETED",
        completedAt: { lt: completedCutoff },
      },
    ],
  };
  const handoffWhere = {
    createdAt: { lt: handoffCutoff },
    OR: [
      { usedAt: { not: null } },
      { expiresAt: { lt: now } },
    ],
  };
  const [signupCount, handoffCount] = await Promise.all([
    prisma.workspaceSignup.count({ where: signupWhere }),
    prisma.workspaceHandoffToken.count({ where: handoffWhere }),
  ]);
  const preview = {
    incompleteCutoff: incompleteCutoff.toISOString(),
    completedCutoff: completedCutoff.toISOString(),
    handoffCutoff: handoffCutoff.toISOString(),
    signupRecords: signupCount,
    handoffTokens: handoffCount,
  };

  if (options.apply !== true) {
    console.log(JSON.stringify({ action: "signup-prune", dryRun: true, preview }, null, 2));
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const handoffs = await tx.workspaceHandoffToken.deleteMany({ where: handoffWhere });
    const signups = await tx.workspaceSignup.deleteMany({ where: signupWhere });
    const audit = await tx.platformAuditLog.create({
      data: {
        action: "SIGNUP_RECORDS_PRUNED",
        entityType: "WorkspaceSignup",
        operatorIdentity: operator,
        beforeState: preview,
        afterState: {
          deletedSignupRecords: signups.count,
          deletedHandoffTokens: handoffs.count,
        },
      },
    });
    return { signups: signups.count, handoffs: handoffs.count, auditId: audit.id };
  });

  console.log(JSON.stringify({
    action: "signup-prune",
    dryRun: false,
    deletedSignupRecords: result.signups,
    deletedHandoffTokens: result.handoffs,
    auditId: result.auditId,
  }, null, 2));
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
