import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { setFallbackTenantContext } from "@/lib/tenant-context";
import {
  buildGymCredentialCode,
  issueGymCredential,
  resolveGymCredential,
  revokeGymCredential,
} from "@/modules/gym/access-credentials";

const TENANT_ID = "tenant_test";
const TENANT_SLUG = "we-discipline";

async function fixture() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const actor = await prisma.user.create({
    data: {
      tenantId: TENANT_ID,
      email: `gym-card-${suffix}@example.test`,
      name: "Gestionnaire salle",
      passwordHash: "test",
      role: "ADMIN",
    },
  });
  const member = await prisma.member.create({
    data: { tenantId: TENANT_ID, firstName: "Carte", lastName: "Membre", phone: `card-${suffix}` },
  });
  return { actor, member };
}

describe("gym member credentials", () => {
  it("issues a signed code, rejects tampering, and revokes it", async () => {
    const { actor, member } = await fixture();
    const issued = await prisma.$transaction((tx) => issueGymCredential(tx, {
      tenantId: TENANT_ID,
      memberId: member.id,
      actorId: actor.id,
    }));
    const resolved = await prisma.$transaction((tx) => resolveGymCredential(tx, {
      tenantId: TENANT_ID,
      credentialCode: issued.credentialCode,
    }));
    expect(resolved).toMatchObject({ status: "ACTIVE", memberId: member.id });

    const tampered = `${issued.credentialCode.slice(0, -1)}${issued.credentialCode.endsWith("a") ? "b" : "a"}`;
    const invalid = await prisma.$transaction((tx) => resolveGymCredential(tx, {
      tenantId: TENANT_ID,
      credentialCode: tampered,
    }));
    expect(invalid).toMatchObject({ status: "INVALID", credential: null });

    await prisma.$transaction((tx) => revokeGymCredential(tx, {
      tenantId: TENANT_ID,
      credentialId: issued.credential.id,
      actorId: actor.id,
      reason: "Carte perdue par le membre",
    }));
    const revoked = await prisma.$transaction((tx) => resolveGymCredential(tx, {
      tenantId: TENANT_ID,
      credentialCode: issued.credentialCode,
    }));
    expect(revoked.status).toBe("REVOKED");
  });

  it("replaces the previous active card and binds signatures to the tenant", async () => {
    const { actor, member } = await fixture();
    const first = await prisma.$transaction((tx) => issueGymCredential(tx, {
      tenantId: TENANT_ID,
      memberId: member.id,
      actorId: actor.id,
    }));
    const second = await prisma.$transaction((tx) => issueGymCredential(tx, {
      tenantId: TENANT_ID,
      memberId: member.id,
      actorId: actor.id,
      replacementReason: "Remplacement de la carte abîmée",
    }));
    expect(await prisma.memberAccessCredential.count({
      where: { tenantId: TENANT_ID, memberId: member.id, revokedAt: null },
    })).toBe(1);
    expect((await prisma.memberAccessCredential.findUniqueOrThrow({ where: { id: first.credential.id } })).revokedAt).not.toBeNull();
    expect(second.credential.id).not.toBe(first.credential.id);

    const otherTenant = await prisma.tenant.upsert({
      where: { slug: "credential-other" },
      create: { id: "tenant_credential_other", slug: "credential-other", name: "Other" },
      update: { status: "ACTIVE" },
    });
    setFallbackTenantContext({ tenantId: otherTenant.id, tenantSlug: otherTenant.slug, host: "credential-other.test" });
    const foreignSignature = buildGymCredentialCode(otherTenant.id, second.credential.id);
    const foreignResolution = await prisma.$transaction((tx) => resolveGymCredential(tx, {
      tenantId: otherTenant.id,
      credentialCode: foreignSignature,
    }));
    expect(foreignResolution.status).toBe("INVALID");
    setFallbackTenantContext({ tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, host: "test.local" });
  });
});
