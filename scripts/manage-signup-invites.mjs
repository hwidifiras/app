import { createHmac, randomBytes } from "node:crypto";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const EDITIONS = ["CLASS", "GYM", "HYBRID"];
const TEMPLATE_EDITIONS = new Map([
  ["martial-arts-dojo", ["CLASS", "HYBRID"]],
  ["yoga-wellness-studio", ["CLASS", "HYBRID"]],
  ["dance-academy", ["CLASS", "HYBRID"]],
  ["group-fitness-studio", ["CLASS", "HYBRID"]],
  ["fitness-gym", ["GYM", "HYBRID"]],
  ["martial-arts-and-gym", ["HYBRID"]],
  ["classes-and-gym", ["HYBRID"]],
  ["custom-class-club", ["CLASS"]],
  ["custom-hybrid-club", ["HYBRID"]],
]);

function usage() {
  console.error(`Usage:
  npm run signup:invite -- create --edition <CLASS|GYM|HYBRID> --operator <identity> [options]
  npm run signup:invite -- list --operator <identity> [--all]
  npm run signup:invite -- inspect --id <invite-id> --operator <identity>
  npm run signup:invite -- revoke --id <invite-id> --operator <identity> [--dry-run]

Create options:
  --email <owner@email>       Restrict the link to one normalized email.
  --templates <key,key>       Preselect compatible activity templates.
  --expires-in-days <1-90>    Default: 7.
  --max-uses <1-100>          Default: 1.
  --dry-run                   Validate and preview without creating a token.

The plaintext invitation token is printed once and is never stored.`);
}

function parseArguments(argv) {
  const [command, ...tokens] = argv;
  const options = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
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

function normalizedEmail(options) {
  if (options.email === undefined) return null;
  if (typeof options.email !== "string") throw new Error("--email expects a value");
  const email = options.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("--email is invalid");
  return email;
}

function signupSecret() {
  const secret = process.env.SIGNUP_TOKEN_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("SIGNUP_TOKEN_SECRET must contain at least 32 characters");
  return secret;
}

function hashInviteToken(token) {
  return createHmac("sha256", signupSecret())
    .update(`we-discipline:signup-invite:v1:${token}`)
    .digest("hex");
}

function templatesFor(options, edition) {
  if (options.templates === undefined) return [];
  if (typeof options.templates !== "string") throw new Error("--templates expects comma-separated keys");
  const templates = Array.from(new Set(options.templates.split(",").map((value) => value.trim()).filter(Boolean)));
  for (const template of templates) {
    const allowedEditions = TEMPLATE_EDITIONS.get(template);
    if (!allowedEditions) throw new Error(`Unknown activity template: ${template}`);
    if (!allowedEditions.includes(edition)) {
      throw new Error(`Template ${template} is not compatible with ${edition}`);
    }
  }
  return templates;
}

function invitationState(invite, now = new Date()) {
  if (invite.revokedAt) return "REVOKED";
  if (invite.expiresAt <= now) return "EXPIRED";
  if (invite.useCount >= invite.maxUses) return "USED";
  return "ACTIVE";
}

function publicInvite(invite) {
  return {
    id: invite.id,
    state: invitationState(invite),
    email: invite.email,
    edition: invite.edition,
    activityTemplateKeys: invite.activityTemplateKeys,
    expiresAt: invite.expiresAt.toISOString(),
    maxUses: invite.maxUses,
    useCount: invite.useCount,
    revokedAt: invite.revokedAt?.toISOString() ?? null,
    operatorIdentity: invite.operatorIdentity,
    createdAt: invite.createdAt.toISOString(),
  };
}

async function createInvite(options, operator, dryRun) {
  const edition = requiredString(options, "edition").toUpperCase();
  if (!EDITIONS.includes(edition)) throw new Error(`Unsupported edition: ${edition}`);
  const email = normalizedEmail(options);
  const activityTemplateKeys = templatesFor(options, edition);
  const expiresInDays = boundedInteger(options, "expires-in-days", 7, 1, 90);
  const maxUses = boundedInteger(options, "max-uses", 1, 1, 100);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1_000);
  const preview = { email, edition, activityTemplateKeys, expiresAt: expiresAt.toISOString(), maxUses };
  if (dryRun) {
    console.log(JSON.stringify({ action: "create", dryRun: true, invitation: preview }, null, 2));
    return;
  }

  const token = randomBytes(32).toString("base64url");
  const invite = await prisma.$transaction(async (tx) => {
    const created = await tx.workspaceSignupInvite.create({
      data: {
        tokenHash: hashInviteToken(token),
        email,
        edition,
        activityTemplateKeys,
        expiresAt,
        maxUses,
        operatorIdentity: operator,
      },
    });
    await tx.platformAuditLog.create({
      data: {
        action: "SIGNUP_INVITE_CREATED",
        entityType: "WorkspaceSignupInvite",
        entityId: created.id,
        operatorIdentity: operator,
        afterState: preview,
      },
    });
    return created;
  });

  const platformUrl = process.env.PLATFORM_APP_URL?.trim().replace(/\/+$/, "");
  console.log(JSON.stringify({
    action: "create",
    invitation: publicInvite(invite),
    token,
    signupUrl: platformUrl ? `${platformUrl}/signup?invite=${encodeURIComponent(token)}` : null,
    warning: "Store or send this link now. The plaintext token cannot be recovered.",
  }, null, 2));
}

async function listInvites(options, operator) {
  const now = new Date();
  const invites = await prisma.workspaceSignupInvite.findMany({
    where: options.all === true
      ? undefined
      : { revokedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  console.log(JSON.stringify({
    action: "list",
    operator,
    invitations: invites.map(publicInvite),
  }, null, 2));
}

async function inspectInvite(options, operator) {
  const id = requiredString(options, "id");
  const invite = await prisma.workspaceSignupInvite.findUnique({
    where: { id },
    include: {
      signups: {
        select: { id: true, email: true, status: true, tenantId: true, createdAt: true, completedAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!invite) throw new Error(`Invitation not found: ${id}`);
  console.log(JSON.stringify({
    action: "inspect",
    operator,
    invitation: publicInvite(invite),
    signups: invite.signups,
  }, null, 2));
}

async function revokeInvite(options, operator, dryRun) {
  const id = requiredString(options, "id");
  const invite = await prisma.workspaceSignupInvite.findUnique({ where: { id } });
  if (!invite) throw new Error(`Invitation not found: ${id}`);
  if (invite.revokedAt) {
    console.log(JSON.stringify({ action: "revoke", changed: false, invitation: publicInvite(invite) }, null, 2));
    return;
  }
  if (dryRun) {
    console.log(JSON.stringify({ action: "revoke", dryRun: true, invitation: publicInvite(invite) }, null, 2));
    return;
  }

  const revoked = await prisma.$transaction(async (tx) => {
    const updated = await tx.workspaceSignupInvite.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    await tx.platformAuditLog.create({
      data: {
        action: "SIGNUP_INVITE_REVOKED",
        entityType: "WorkspaceSignupInvite",
        entityId: id,
        operatorIdentity: operator,
        beforeState: publicInvite(invite),
        afterState: publicInvite(updated),
      },
    });
    return updated;
  });
  console.log(JSON.stringify({ action: "revoke", changed: true, invitation: publicInvite(revoked) }, null, 2));
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2));
  if (!command || options.help === true) {
    usage();
    process.exitCode = command ? 0 : 1;
    return;
  }
  const operator = requiredString(options, "operator");
  if (operator.length < 3) throw new Error("--operator must clearly identify the operator");
  const dryRun = options["dry-run"] === true;

  if (command === "create") return createInvite(options, operator, dryRun);
  if (command === "list") return listInvites(options, operator);
  if (command === "inspect") return inspectInvite(options, operator);
  if (command === "revoke") return revokeInvite(options, operator, dryRun);
  throw new Error(`Unknown command: ${command}`);
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
