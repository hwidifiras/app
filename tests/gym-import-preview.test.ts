import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { previewGymImport } from "@/modules/gym/gym-import";

const TENANT_ID = "tenant_test";

describe("gym import preview", () => {
  it("validates a French CSV without creating business records", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const planName = `Pass import ${suffix}`;
    await prisma.subscriptionPlan.create({
      data: {
        tenantId: TENANT_ID,
        name: planName,
        planKind: "GYM",
        price: 6000,
        totalSessions: 0,
        validityDays: 30,
        entitlements: {
          create: {
            tenantId: TENANT_ID,
            type: "GYM_ACCESS",
            gymAccessMode: "UNLIMITED",
          },
        },
      },
    });

    const before = await Promise.all([
      prisma.member.count({ where: { tenantId: TENANT_ID } }),
      prisma.memberSubscription.count({ where: { tenantId: TENANT_ID } }),
      prisma.payment.count({ where: { tenantId: TENANT_ID } }),
    ]);
    const phone = `import-${suffix}`;
    const csv = [
      "Prenom;Nom;Telephone;Email;Formule;Date debut;Montant paye",
      `Amel;Trabelsi;${phone};amel@example.test;${planName};15/08/2026;60`,
      `Ali;Ben Salah;${phone};;${planName};15/08/2026;60`,
    ].join("\n");

    const preview = await previewGymImport({
      tenantId: TENANT_ID,
      buffer: Buffer.from(csv, "utf8"),
      fileName: "adherents.csv",
    });

    expect(preview).toMatchObject({ totalRows: 2, readyRows: 1, errorRows: 1, dryRun: true });
    expect(preview.rows[0]).toMatchObject({ status: "READY", memberAction: "CREATE", paidCents: 6000 });
    expect(preview.rows[1].errors.some((error) => error.includes("dans le fichier"))).toBe(true);
    const after = await Promise.all([
      prisma.member.count({ where: { tenantId: TENANT_ID } }),
      prisma.memberSubscription.count({ where: { tenantId: TENANT_ID } }),
      prisma.payment.count({ where: { tenantId: TENANT_ID } }),
    ]);
    expect(after).toEqual(before);
  });
});
