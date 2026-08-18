import { createHash, randomBytes } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PREFIX = "public-demo-";
const tenantSlug = (
  process.env.DEMO_TENANT_SLUG ??
  process.env.DEFAULT_TENANT_SLUG ??
  "martial-demo"
).trim().toLowerCase();
const demoEmail = (
  process.env.SAAS_DEMO_ACCOUNT_EMAIL ?? "demo@we-discipline.test"
).trim().toLowerCase();
const action = (process.argv[2] ?? "status").trim().toLowerCase();
const confirmed = process.argv.includes("--confirm-demo-reset");

const dayNames = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const sports = [
  { key: "kickboxing", name: "Kick-boxing", description: "Cours adultes, adolescents et compétiteurs" },
  { key: "taekwondo", name: "Taekwondo", description: "Initiation, enfants et perfectionnement" },
  { key: "jiujitsu", name: "Jiu-jitsu brésilien", description: "Technique au sol et sparring encadré" },
  { key: "karate", name: "Karaté", description: "Kihon, kata et kumite" },
  { key: "mma", name: "MMA", description: "Cours multidisciplinaire adultes" },
];

const coaches = [
  { key: "sami", firstName: "Sami", lastName: "Ben Amor", phone: "71000101", email: "sami@demo.test", sports: ["kickboxing", "mma"] },
  { key: "meriem", firstName: "Meriem", lastName: "Trabelsi", phone: "71000102", email: "meriem@demo.test", sports: ["taekwondo"] },
  { key: "hatem", firstName: "Hatem", lastName: "Gharbi", phone: "71000103", email: "hatem@demo.test", sports: ["jiujitsu", "mma"] },
  { key: "ines", firstName: "Inès", lastName: "Ayari", phone: "71000104", email: "ines@demo.test", sports: ["karate"] },
  { key: "walid", firstName: "Walid", lastName: "Mansouri", phone: "71000105", email: "walid@demo.test", sports: ["kickboxing", "taekwondo"] },
];

const groups = [
  { key: "kick-adultes", name: "Kick-boxing adultes", sport: "kickboxing", coach: "sami", groupType: "ADULTS", genderPolicy: "MIXED", capacity: 24, room: "Salle 1", slots: [["TUESDAY", "18:15", 75], ["THURSDAY", "18:15", 75], ["SATURDAY", "16:30", 75]] },
  { key: "kick-ados", name: "Kick-boxing ados", sport: "kickboxing", coach: "walid", groupType: "MIXED", genderPolicy: "MIXED", capacity: 18, room: "Salle 2", slots: [["MONDAY", "17:00", 60], ["WEDNESDAY", "17:00", 60], ["FRIDAY", "17:00", 60]] },
  { key: "tkd-enfants", name: "Taekwondo enfants", sport: "taekwondo", coach: "meriem", groupType: "KIDS", genderPolicy: "MIXED", capacity: 22, room: "Salle 1", slots: [["MONDAY", "18:00", 60], ["WEDNESDAY", "18:00", 60], ["SATURDAY", "10:00", 60]] },
  { key: "tkd-adultes", name: "Taekwondo adultes", sport: "taekwondo", coach: "walid", groupType: "ADULTS", genderPolicy: "MIXED", capacity: 20, room: "Salle 2", slots: [["TUESDAY", "19:30", 75], ["THURSDAY", "19:30", 75]] },
  { key: "bjj-debutants", name: "Jiu-jitsu débutants", sport: "jiujitsu", coach: "hatem", groupType: "ADULTS", genderPolicy: "MIXED", capacity: 20, room: "Tatami", slots: [["MONDAY", "19:30", 90], ["WEDNESDAY", "19:30", 90]] },
  { key: "bjj-avances", name: "Jiu-jitsu avancés", sport: "jiujitsu", coach: "hatem", groupType: "ADULTS", genderPolicy: "MIXED", capacity: 16, room: "Tatami", slots: [["TUESDAY", "20:00", 90], ["FRIDAY", "19:30", 90]] },
  { key: "karate-enfants", name: "Karaté enfants", sport: "karate", coach: "ines", groupType: "KIDS", genderPolicy: "MIXED", capacity: 20, room: "Salle 2", slots: [["TUESDAY", "17:00", 60], ["THURSDAY", "17:00", 60], ["SATURDAY", "11:15", 60]] },
  { key: "mma-adultes", name: "MMA adultes", sport: "mma", coach: "sami", groupType: "ADULTS", genderPolicy: "MIXED", capacity: 18, room: "Cage", slots: [["WEDNESDAY", "20:00", 90], ["SATURDAY", "18:00", 90]] },
];

const memberNames = [
  ["Yassine", "Ben Amor"], ["Ahmed", "Trabelsi"], ["Nour", "Khelifi"], ["Malek", "Jaziri"],
  ["Inès", "Mansouri"], ["Aziz", "Gharbi"], ["Rania", "Ayari"], ["Omar", "Ben Salem"],
  ["Lina", "Hamdi"], ["Syrine", "Mejri"], ["Fares", "Chaabane"], ["Mehdi", "Bouazizi"],
  ["Aya", "Dridi"], ["Rayen", "Saidi"], ["Meriem", "Abid"], ["Adam", "Karray"],
  ["Sarra", "Jebali"], ["Bilel", "Mabrouk"], ["Eya", "Louati"], ["Anis", "Tlili"],
  ["Farah", "Haddad"], ["Skander", "Chatti"], ["Youssef", "Naffati"], ["Amira", "Ben Youssef"],
  ["Iyed", "Sassi"], ["Salma", "Kacem"], ["Wael", "Zouari"], ["Rim", "Ferchichi"],
  ["Aymen", "Gdiri"], ["Mariem", "Khemiri"], ["Houssem", "Rekik"], ["Nesrine", "Baccouche"],
];

function id(kind, key) {
  return `${PREFIX}${kind}-${key}`;
}

function dateOnlyInTimeZone(date = new Date(), timeZone = "Africa/Tunis") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return new Date(Date.UTC(year, month - 1, day));
}

function plusDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function atTime(date, time) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hours,
    minutes,
  ));
}

function endTime(startTime, durationMinutes) {
  const [hours, minutes] = startTime.split(":").map(Number);
  const total = hours * 60 + minutes + durationMinutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function assertSafeTarget() {
  if (!tenantSlug.includes("demo")) {
    throw new Error(`Refusing to seed non-demo tenant: ${tenantSlug}`);
  }
  if (action === "apply" && !confirmed) {
    throw new Error("Apply requires --confirm-demo-reset.");
  }
}

async function resolveTenant() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, slug: true, name: true },
  });
  if (!tenant) throw new Error(`Demo tenant not found: ${tenantSlug}`);
  return tenant;
}

async function removePreviousSeed(tenantId) {
  const subscriptionFilter = { tenantId, memberSubscriptionId: { startsWith: PREFIX } };
  await prisma.receipt.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
  await prisma.attendance.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
  await prisma.entitlementAdjustment.deleteMany({ where: subscriptionFilter });
  await prisma.subscriptionPause.deleteMany({ where: subscriptionFilter });
  await prisma.payment.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
  await prisma.offerApplication.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
  await prisma.offer.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
  await prisma.subscriptionEntitlement.deleteMany({ where: subscriptionFilter });
  await prisma.memberSubscription.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
  await prisma.groupMember.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
  await prisma.session.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
  await prisma.groupSchedule.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
  await prisma.group.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
  await prisma.coachSportQualification.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
  await prisma.planEntitlement.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
  await prisma.subscriptionPlan.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
  await prisma.coach.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
  await prisma.sport.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
  await prisma.householdMember.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
  await prisma.household.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
  await prisma.member.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
  await prisma.notificationRead.deleteMany({ where: { tenantId, userId: { startsWith: PREFIX } } });
  await prisma.userPermission.deleteMany({ where: { tenantId, userId: { startsWith: PREFIX } } });
  await prisma.auditLog.deleteMany({
    where: {
      tenantId,
      OR: [{ entityId: { startsWith: PREFIX } }, { userId: { startsWith: PREFIX } }],
    },
  });
  await prisma.user.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } });
}

async function createReceipt({ tenantId, adminId, payment, subscription, member, plan, sport, sequence }) {
  const issuedAt = payment.paymentDate;
  const receiptId = id("receipt", String(sequence).padStart(3, "0"));
  const receiptNumber = `WD-${issuedAt.getUTCFullYear()}-${String(sequence).padStart(6, "0")}`;
  const verificationCode = createHash("sha256").update(payment.id).digest("hex").slice(0, 10).toUpperCase();
  const paidAfterCents = payment.amount;
  const snapshotWithoutReceipt = {
    club: {
      name: "Dojo Atlas Tunis",
      logoUrl: "",
      address: "12 avenue de Carthage, Tunis",
      phone: "+216 71 000 200",
      legalName: "Association Sportive Dojo Atlas",
      taxId: "DEMO-TN-001",
      footer: "Merci pour votre confiance. Reçu de démonstration sans valeur comptable.",
    },
    member: {
      id: member.id,
      name: `${member.firstName} ${member.lastName}`,
      phone: member.phone,
    },
    subscription: {
      id: subscription.id,
      planName: plan.name,
      sportName: sport.name,
      entitlements: [{
        label: sport.name,
        detail: `${plan.totalSessions} séances · ${plan.sessionsPerWeek}/semaine`,
      }],
      amountCents: subscription.amount,
      listPriceCents: subscription.listPriceCents ?? subscription.amount,
      discountCents: subscription.discountCents,
      offerName: subscription.offerName,
      startDate: subscription.startDate.toISOString(),
      endDate: subscription.endDate?.toISOString() ?? null,
    },
    payment: {
      id: payment.id,
      amountCents: payment.amount,
      paymentDate: payment.paymentDate.toISOString(),
      paymentMethod: payment.paymentMethod,
      notes: payment.notes,
    },
    totals: {
      paidAfterCents,
      remainingAfterCents: Math.max(0, subscription.amount - paidAfterCents),
    },
  };
  const contentHash = createHash("sha256")
    .update(JSON.stringify(snapshotWithoutReceipt))
    .digest("hex");
  const snapshot = {
    receipt: {
      id: receiptId,
      receiptNumber,
      verificationCode,
      status: "ISSUED",
      issuedAt: issuedAt.toISOString(),
      contentHash,
    },
    ...snapshotWithoutReceipt,
  };

  await prisma.receipt.create({
    data: {
      id: receiptId,
      tenantId,
      paymentId: payment.id,
      receiptNumber,
      verificationCode,
      status: "ISSUED",
      issuedAt,
      issuedById: adminId,
      snapshotJson: JSON.stringify(snapshot),
      contentHash,
    },
  });
}

async function applySeed(tenant) {
  const today = dateOnlyInTimeZone();
  const activeFrom = plusDays(today, -90);
  const adminId = id("user", "admin");

  await removePreviousSeed(tenant.id);

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { name: "Dojo Atlas Tunis - Démo", status: "ACTIVE" },
  });
  await prisma.tenantModule.upsert({
    where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: "CLASS_MANAGEMENT" } },
    update: { status: "ENABLED", enabledAt: new Date(), disabledAt: null },
    create: {
      tenantId: tenant.id,
      moduleKey: "CLASS_MANAGEMENT",
      status: "ENABLED",
      enabledAt: new Date(),
    },
  });
  await prisma.tenantModule.upsert({
    where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: "GYM_ACCESS" } },
    update: { status: "DISABLED", disabledAt: new Date() },
    create: {
      tenantId: tenant.id,
      moduleKey: "GYM_ACCESS",
      status: "DISABLED",
      disabledAt: new Date(),
    },
  });

  await prisma.clubSettings.upsert({
    where: { tenantId: tenant.id },
    update: {
      clubName: "Dojo Atlas Tunis",
      clubAddress: "12 avenue de Carthage, Tunis",
      clubPhone: "+216 71 000 200",
      receiptLegalName: "Association Sportive Dojo Atlas",
      receiptTaxId: "DEMO-TN-001",
      receiptPrefix: "WD",
      nextReceiptSequence: 100,
      receiptFooter: "Merci pour votre confiance. Reçu de démonstration sans valeur comptable.",
      allowCheckInWithPartialPayment: true,
      allowCheckInWithoutSubscription: false,
      absentConsumesSession: true,
      workingDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"],
      debtAlertThresholdCents: 1000,
      dashboardDefaultMode: "PILOTAGE",
      dashboardShowTodaySessions: true,
      dashboardShowCashToday: true,
      dashboardShowDataConfidence: true,
      dashboardShowCashTrend: true,
      dashboardShowMembersOverview: true,
      dashboardShowCommercialInsights: true,
      dashboardShowDetailedDebts: true,
    },
    create: {
      tenantId: tenant.id,
      clubName: "Dojo Atlas Tunis",
      clubAddress: "12 avenue de Carthage, Tunis",
      clubPhone: "+216 71 000 200",
      receiptLegalName: "Association Sportive Dojo Atlas",
      receiptTaxId: "DEMO-TN-001",
      receiptPrefix: "WD",
      nextReceiptSequence: 100,
      receiptFooter: "Merci pour votre confiance. Reçu de démonstration sans valeur comptable.",
      allowCheckInWithPartialPayment: true,
      workingDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"],
      debtAlertThresholdCents: 1000,
      dashboardDefaultMode: "PILOTAGE",
    },
  });

  const passwordHash = await bcrypt.hash(
    process.env.SAAS_DEMO_ACCOUNT_PASSWORD ?? randomBytes(32).toString("base64url"),
    10,
  );
  await prisma.user.create({
    data: {
      id: adminId,
      tenantId: tenant.id,
      email: demoEmail,
      name: "Admin Démo",
      role: "ADMIN",
      isActive: true,
      passwordHash,
    },
  });

  const sportRows = new Map();
  for (const sport of sports) {
    const row = await prisma.sport.create({
      data: {
        id: id("sport", sport.key),
        tenantId: tenant.id,
        name: sport.name,
        description: sport.description,
        isActive: true,
      },
    });
    sportRows.set(sport.key, row);
  }

  const coachRows = new Map();
  for (const coach of coaches) {
    const primarySport = sportRows.get(coach.sports[0]);
    const row = await prisma.coach.create({
      data: {
        id: id("coach", coach.key),
        tenantId: tenant.id,
        firstName: coach.firstName,
        lastName: coach.lastName,
        phone: coach.phone,
        email: coach.email,
        sportId: primarySport.id,
        isActive: true,
      },
    });
    coachRows.set(coach.key, row);

    for (const [qualificationIndex, sportKey] of coach.sports.entries()) {
      await prisma.coachSportQualification.create({
        data: {
          id: id("qualification", `${coach.key}-${sportKey}`),
          tenantId: tenant.id,
          coachId: row.id,
          sportId: sportRows.get(sportKey).id,
          isPrimary: qualificationIndex === 0,
        },
      });
    }
  }

  const groupRows = new Map();
  const scheduleRows = new Map();
  for (const group of groups) {
    const row = await prisma.group.create({
      data: {
        id: id("group", group.key),
        tenantId: tenant.id,
        name: group.name,
        groupType: group.groupType,
        genderPolicy: group.genderPolicy,
        sportId: sportRows.get(group.sport).id,
        coachId: coachRows.get(group.coach).id,
        capacity: group.capacity,
        room: group.room,
        isActive: true,
      },
    });
    groupRows.set(group.key, row);

    for (const [dayOfWeek, startTime, durationMinutes] of group.slots) {
      const schedule = await prisma.groupSchedule.create({
        data: {
          id: id("schedule", `${group.key}-${dayOfWeek.toLowerCase()}-${startTime.replace(":", "")}`),
          tenantId: tenant.id,
          groupId: row.id,
          dayOfWeek,
          startTime,
          durationMinutes,
          effectiveFrom: activeFrom,
        },
      });
      scheduleRows.set(`${group.key}|${dayOfWeek}|${startTime}`, schedule);
    }
  }

  const planRows = new Map();
  const entitlementRows = new Map();
  for (const sport of sports) {
    const sportRow = sportRows.get(sport.key);
    for (const planDefinition of [
      { key: "8", suffix: "8 séances", price: 7000, totalSessions: 8, sessionsPerWeek: 2 },
      { key: "12", suffix: "12 séances", price: 9000, totalSessions: 12, sessionsPerWeek: 3 },
    ]) {
      const planKey = `${sport.key}-${planDefinition.key}`;
      const plan = await prisma.subscriptionPlan.create({
        data: {
          id: id("plan", planKey),
          tenantId: tenant.id,
          name: `${sport.name} · ${planDefinition.suffix}`,
          description: `Formule mensuelle ${sport.name}`,
          price: planDefinition.price,
          totalSessions: planDefinition.totalSessions,
          sessionsPerWeek: planDefinition.sessionsPerWeek,
          validityDays: 30,
          planKind: "CLASS",
          activationPolicy: "FIXED_DATE",
          sportId: sportRow.id,
          isActive: true,
        },
      });
      const entitlement = await prisma.planEntitlement.create({
        data: {
          id: id("plan-entitlement", planKey),
          tenantId: tenant.id,
          planId: plan.id,
          type: "CLASS_SESSIONS",
          sportId: sportRow.id,
          sessionsPerWeek: planDefinition.sessionsPerWeek,
          grantedUnits: planDefinition.totalSessions,
        },
      });
      planRows.set(planKey, plan);
      entitlementRows.set(planKey, entitlement);
    }
  }

  const memberRows = [];
  const subscriptionByMember = new Map();
  const subscriptionEntitlementByMember = new Map();
  const membersByGroup = new Map(groups.map((group) => [group.key, []]));
  const paymentRows = [];

  for (const [index, [firstName, lastName]] of memberNames.entries()) {
    const group = groups[index % groups.length];
    const isKid = group.groupType === "KIDS";
    const archived = index >= memberNames.length - 2;
    const member = await prisma.member.create({
      data: {
        id: id("member", String(index + 1).padStart(2, "0")),
        tenantId: tenant.id,
        firstName,
        lastName,
        phone: `2210${String(index + 1).padStart(4, "0")}`,
        email: `${firstName}.${lastName}.${index + 1}@demo.test`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
        memberType: isKid ? "KID" : "ADULT",
        gender: index % 2 === 0 ? "MALE" : "FEMALE",
        birthDate: isKid
          ? new Date(Date.UTC(2014 + (index % 5), index % 12, 4 + (index % 20)))
          : new Date(Date.UTC(1988 + (index % 15), index % 12, 4 + (index % 20))),
        parentName: isKid ? `Parent de ${firstName}` : null,
        parentPhone: isKid ? `5510${String(index + 1).padStart(4, "0")}` : null,
        address: "Tunis",
        status: archived ? "ARCHIVED" : "ACTIVE",
        joinedAt: plusDays(today, -(5 + index * 3)),
        archivedAt: archived ? plusDays(today, -3) : null,
      },
    });
    memberRows.push(member);
    if (archived) continue;

    membersByGroup.get(group.key).push(member);
    await prisma.groupMember.create({
      data: {
        id: id("group-member", String(index + 1).padStart(2, "0")),
        tenantId: tenant.id,
        groupId: groupRows.get(group.key).id,
        memberId: member.id,
        startDate: plusDays(today, -60),
        status: "ACTIVE",
      },
    });

    const planVariant = index % 3 === 0 ? "12" : "8";
    const planKey = `${group.sport}-${planVariant}`;
    const plan = planRows.get(planKey);
    const startDate = index % 9 === 0 ? plusDays(today, -27) : plusDays(today, -(8 + (index % 13)));
    const endDate = plusDays(startDate, 29);
    const remainingSessions = Math.max(1, plan.totalSessions - (index % 7));
    const hasDiscount = index % 11 === 0;
    const amount = hasDiscount ? plan.price - 1000 : plan.price;
    const subscription = await prisma.memberSubscription.create({
      data: {
        id: id("subscription", String(index + 1).padStart(2, "0")),
        tenantId: tenant.id,
        memberId: member.id,
        planId: plan.id,
        sportId: sportRows.get(group.sport).id,
        startDate,
        endDate,
        amount,
        listPriceCents: plan.price,
        discountCents: hasDiscount ? 1000 : 0,
        offerName: hasDiscount ? "Promotion lancement" : null,
        remainingSessions,
        status: "ACTIVE",
        activationPolicy: "FIXED_DATE",
      },
    });
    const subscriptionEntitlement = await prisma.subscriptionEntitlement.create({
      data: {
        id: id("subscription-entitlement", String(index + 1).padStart(2, "0")),
        tenantId: tenant.id,
        memberSubscriptionId: subscription.id,
        planEntitlementId: entitlementRows.get(planKey).id,
        type: "CLASS_SESSIONS",
        sportId: sportRows.get(group.sport).id,
        sessionsPerWeek: plan.sessionsPerWeek,
        grantedUnits: plan.totalSessions,
        remainingUnits: remainingSessions,
        startDate,
        endDate,
      },
    });
    subscriptionByMember.set(member.id, { subscription, plan, sport: sportRows.get(group.sport) });
    subscriptionEntitlementByMember.set(member.id, subscriptionEntitlement);

    const unpaid = index % 10 === 3 || index % 10 === 7;
    const partial = !unpaid && (index % 8 === 2 || index % 8 === 5);
    if (!unpaid) {
      const paymentDate = atTime(plusDays(today, -(index % 7)), `${String(9 + (index % 8)).padStart(2, "0")}:${index % 2 === 0 ? "15" : "40"}`);
      const payment = await prisma.payment.create({
        data: {
          id: id("payment", String(index + 1).padStart(2, "0")),
          tenantId: tenant.id,
          memberSubscriptionId: subscription.id,
          amount: partial ? Math.floor(amount / 2) : amount,
          entryType: "PAYMENT",
          createdById: adminId,
          paymentDate,
          paymentMethod: index % 4 === 0 ? "CARD" : index % 6 === 0 ? "TRANSFER" : "CASH",
          notes: partial ? "Premier versement" : "Règlement abonnement",
        },
      });
      paymentRows.push({ payment, subscription, member, plan, sport: sportRows.get(group.sport) });
    }
  }

  await prisma.offer.createMany({
    data: [
      {
        id: id("offer", "family"), tenantId: tenant.id, name: "Réduction famille", description: "10 % à partir du deuxième membre du foyer", kind: "PERCENT_OFF", planScope: "CLASS", isActive: true, rules: JSON.stringify({ percentOff: 10 }), percentOff: 10, minMembers: 2, requiresHousehold: true, createdById: adminId,
      },
      {
        id: id("offer", "second-discipline"), tenantId: tenant.id, name: "Deuxième discipline", description: "15 % sur la deuxième discipline", kind: "SECOND_DISCIPLINE", planScope: "CLASS", isActive: true, rules: JSON.stringify({ percentOff: 15 }), percentOff: 15, createdById: adminId,
      },
      {
        id: id("offer", "launch"), tenantId: tenant.id, name: "Promotion lancement", description: "10,00 TND de remise manuelle", kind: "FIXED_OFF", planScope: "CLASS", isActive: true, rules: JSON.stringify({ amountOffCents: 1000 }), amountOffCents: 1000, createdById: adminId,
      },
    ],
  });

  const sessions = [];
  for (let offset = -8; offset <= 7; offset += 1) {
    const sessionDate = plusDays(today, offset);
    const dayOfWeek = dayNames[sessionDate.getUTCDay()];
    for (const group of groups) {
      for (const [slotDay, startTime, durationMinutes] of group.slots) {
        if (slotDay !== dayOfWeek) continue;
        const status = offset < -1 ? "COMPLETED" : "PLANNED";
        const session = await prisma.session.create({
          data: {
            id: id("session", `${dateKey(sessionDate)}-${group.key}-${startTime.replace(":", "")}`),
            tenantId: tenant.id,
            groupId: groupRows.get(group.key).id,
            scheduleId: scheduleRows.get(`${group.key}|${slotDay}|${startTime}`).id,
            sessionDate,
            startTime,
            endTime: endTime(startTime, durationMinutes),
            coachId: coachRows.get(group.coach).id,
            room: group.room,
            status,
          },
        });
        sessions.push({ ...session, groupKey: group.key, offset });
      }
    }
  }

  const todaySpecials = [
    { groupKey: "tkd-enfants", startTime: "08:30", duration: 60 },
    { groupKey: "kick-adultes", startTime: "17:15", duration: 75 },
    { groupKey: "bjj-avances", startTime: "19:15", duration: 90 },
  ];
  for (const special of todaySpecials) {
    const group = groups.find((item) => item.key === special.groupKey);
    const session = await prisma.session.create({
      data: {
        id: id("session", `${dateKey(today)}-${group.key}-special-${special.startTime.replace(":", "")}`),
        tenantId: tenant.id,
        groupId: groupRows.get(group.key).id,
        sessionDate: today,
        startTime: special.startTime,
        endTime: endTime(special.startTime, special.duration),
        coachId: coachRows.get(group.coach).id,
        room: group.room,
        status: "PLANNED",
      },
    });
    sessions.push({ ...session, groupKey: group.key, offset: 0, special: true });
  }

  const yesterdayOpen = sessions.find((session) => session.offset === -1);
  for (const session of sessions) {
    const members = membersByGroup.get(session.groupKey) ?? [];
    const isHistorical = session.status === "COMPLETED";
    const isOpenYesterday = yesterdayOpen?.id === session.id;
    const isMorningDemo = session.special && session.startTime === "08:30";
    if (!isHistorical && !isOpenYesterday && !isMorningDemo) continue;

    const attendanceMembers = isHistorical
      ? members
      : members.slice(0, Math.max(1, members.length - 1));
    for (const [memberIndex, member] of attendanceMembers.entries()) {
      const subscriptionData = subscriptionByMember.get(member.id);
      if (!subscriptionData) continue;
      await prisma.attendance.create({
        data: {
          id: id("attendance", `${session.id.slice(PREFIX.length)}-${member.id.slice(PREFIX.length)}`),
          tenantId: tenant.id,
          sessionId: session.id,
          memberId: member.id,
          memberSubscriptionId: subscriptionData.subscription.id,
          subscriptionEntitlementId: subscriptionEntitlementByMember.get(member.id).id,
          status: memberIndex % 7 === 6 ? "ABSENT" : "PRESENT",
          checkedBy: adminId,
          checkedAt: atTime(session.sessionDate, session.endTime),
        },
      });
    }
  }

  let receiptSequence = 1;
  for (const row of paymentRows) {
    if (receiptSequence > paymentRows.length - 2) break;
    await createReceipt({ tenantId: tenant.id, adminId, ...row, sequence: receiptSequence });
    receiptSequence += 1;
  }

  const auditRows = [
    ["MEMBER_CREATED", "Member", memberRows[0].id, "Nouvelle inscription depuis l'accueil"],
    ["SUBSCRIPTION_CREATED", "MemberSubscription", subscriptionByMember.get(memberRows[0].id).subscription.id, "Formule mensuelle activée"],
    ["PAYMENT_CREATED", "Payment", paymentRows.at(-1).payment.id, "Paiement et reçu enregistrés"],
    ["ATTENDANCE_UPDATED", "Session", todaySpecials[0].groupKey, "Pointage du matin en cours"],
    ["SESSION_COMPLETED", "Session", sessions.find((session) => session.status === "COMPLETED").id, "Séance finalisée"],
  ];
  for (const [index, [auditAction, entityType, entityId, summary]] of auditRows.entries()) {
    await prisma.auditLog.create({
      data: {
        id: id("audit", String(index + 1).padStart(2, "0")),
        tenantId: tenant.id,
        action: auditAction,
        entityType,
        entityId,
        userId: adminId,
        details: JSON.stringify({ summary, demo: true }),
        createdAt: atTime(plusDays(today, index === 0 ? -1 : 0), `${String(9 + index).padStart(2, "0")}:10`),
      },
    });
  }

  return status(tenant.id);
}

async function status(tenantId) {
  const [users, members, sportsCount, coachesCount, groupsCount, sessionsCount, subscriptionsCount, paymentsCount, receiptsCount, attendancesCount, debtRows] = await Promise.all([
    prisma.user.count({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.member.count({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.sport.count({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.coach.count({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.group.count({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.session.count({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.memberSubscription.count({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.payment.count({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.receipt.count({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.attendance.count({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.memberSubscription.findMany({
      where: { tenantId, id: { startsWith: PREFIX } },
      select: { amount: true, payments: { select: { amount: true } } },
    }),
  ]);
  const outstandingCents = debtRows.reduce(
    (sum, row) => sum + Math.max(0, row.amount - row.payments.reduce((paid, payment) => paid + payment.amount, 0)),
    0,
  );
  return {
    users,
    members,
    sports: sportsCount,
    coaches: coachesCount,
    groups: groupsCount,
    sessions: sessionsCount,
    subscriptions: subscriptionsCount,
    payments: paymentsCount,
    receipts: receiptsCount,
    attendances: attendancesCount,
    outstandingCents,
  };
}

function usage() {
  console.log(`Usage:
  DEMO_TENANT_SLUG=martial-demo node scripts/seed-public-demo.mjs status
  DEMO_TENANT_SLUG=martial-demo node scripts/seed-public-demo.mjs apply --confirm-demo-reset

The apply command refuses non-demo tenant slugs and only replaces records whose IDs start with ${PREFIX}.
`);
}

try {
  assertSafeTarget();
  if (!new Set(["apply", "status"]).has(action)) {
    usage();
    throw new Error(`Unknown action: ${action}`);
  }
  const tenant = await resolveTenant();
  const counts = action === "apply" ? await applySeed(tenant) : await status(tenant.id);
  console.log(JSON.stringify({ action, tenant: tenant.slug, demoEmail, counts }, null, 2));
} finally {
  await prisma.$disconnect();
}
