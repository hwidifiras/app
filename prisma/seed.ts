import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const dayOfWeekValues = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;

function utcDateOnlyForTimeZone(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

async function main() {
  console.log("Seeding dojo v0 demo data...");

  await prisma.clubSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      allowCheckInWithPartialPayment: true,
      allowPublicRegister: false,
      maxStaffDiscountPercent: 30,
    },
    update: {},
  });

  const passwordHash = await bcrypt.hash("admin1234", 10);
  await prisma.user.upsert({
    where: { email: "admin@gym.local" },
    create: {
      email: "admin@gym.local",
      name: "Admin",
      role: "ADMIN",
      passwordHash,
      isActive: true,
    },
    update: { passwordHash, role: "ADMIN", isActive: true },
  });

  const bjj = await prisma.sport.upsert({
    where: { name: "Jiu-Jitsu" },
    create: { name: "Jiu-Jitsu", description: "BJJ", isActive: true },
    update: {},
  });

  const karate = await prisma.sport.upsert({
    where: { name: "Karate" },
    create: { name: "Karate", description: "Karate", isActive: true },
    update: {},
  });

  const coach = await prisma.coach.upsert({
    where: { phone: "06-87-65-43-21" },
    create: {
      firstName: "Ahmed",
      lastName: "Coach",
      phone: "06-87-65-43-21",
      sportId: bjj.id,
      isActive: true,
    },
    update: {},
  });

  const group = await prisma.group.upsert({
    where: { id: "seed-group-bjj" },
    create: {
      id: "seed-group-bjj",
      name: "BJJ Soir",
      sportId: bjj.id,
      coachId: coach.id,
      capacity: 20,
      room: "Dojo A",
      isActive: true,
    },
    update: {},
  });

  const planBjj = await prisma.subscriptionPlan.upsert({
    where: { name: "BJJ 12 séances / mois" },
    create: {
      name: "BJJ 12 séances / mois",
      price: 50000,
      totalSessions: 12,
      sessionsPerWeek: 3,
      validityDays: 30,
      sportId: bjj.id,
      isActive: true,
    },
    update: { sportId: bjj.id },
  });

  const planKarate = await prisma.subscriptionPlan.upsert({
    where: { name: "Karate 8 séances" },
    create: {
      name: "Karate 8 séances",
      price: 40000,
      totalSessions: 8,
      validityDays: 30,
      sportId: karate.id,
      isActive: true,
    },
    update: { sportId: karate.id },
  });

  const member1 = await prisma.member.upsert({
    where: { phone: "06-11-11-11-11" },
    create: {
      firstName: "Karim",
      lastName: "Test",
      phone: "06-11-11-11-11",
      status: "ACTIVE",
    },
    update: {},
  });

  const member2 = await prisma.member.upsert({
    where: { phone: "06-22-22-22-22" },
    create: {
      firstName: "Sami",
      lastName: "Test",
      phone: "06-22-22-22-22",
      memberType: "KID",
      status: "ACTIVE",
    },
    update: {},
  });

  const household = await prisma.household.create({
    data: { label: "Famille Test" },
  });

  for (const row of [
    { householdId: household.id, memberId: member1.id, relationship: "PARENT" as const },
    { householdId: household.id, memberId: member2.id, relationship: "CHILD" as const },
  ]) {
    await prisma.householdMember.upsert({
      where: { memberId: row.memberId },
      create: row,
      update: row,
    });
  }

  const tz = process.env.APP_TIMEZONE?.trim() || "Africa/Tunis";
  const today = utcDateOnlyForTimeZone(new Date(), tz);
  const todayDay = dayOfWeekValues[new Date().getDay()];

  await prisma.groupSchedule.upsert({
    where: { id: "seed-schedule-bjj" },
    create: {
      id: "seed-schedule-bjj",
      groupId: group.id,
      dayOfWeek: todayDay,
      startTime: "18:00",
      durationMinutes: 90,
    },
    update: {},
  });

  await prisma.session.upsert({
    where: {
      groupId_sessionDate_startTime: {
        groupId: group.id,
        sessionDate: today,
        startTime: "18:00",
      },
    },
    create: {
      groupId: group.id,
      coachId: coach.id,
      sessionDate: today,
      startTime: "18:00",
      endTime: "19:30",
      room: "Dojo A",
      status: "PLANNED",
    },
    update: {},
  });

  await prisma.memberSubscription.upsert({
    where: { id: "seed-sub-karim-bjj" },
    create: {
      id: "seed-sub-karim-bjj",
      memberId: member1.id,
      planId: planBjj.id,
      sportId: bjj.id,
      startDate: new Date(today.getTime() - 7 * 86400000),
      endDate: new Date(today.getTime() + 23 * 86400000),
      amount: planBjj.price,
      remainingSessions: 10,
      status: "ACTIVE",
    },
    update: { sportId: bjj.id },
  });

  await prisma.groupMember.upsert({
    where: { groupId_memberId: { groupId: group.id, memberId: member1.id } },
    create: {
      groupId: group.id,
      memberId: member1.id,
      startDate: new Date(),
      status: "ACTIVE",
    },
    update: { status: "ACTIVE" },
  });

  await prisma.payment.upsert({
    where: { id: "seed-pay-karim" },
    create: {
      id: "seed-pay-karim",
      memberSubscriptionId: "seed-sub-karim-bjj",
      amount: 50000,
      paymentMethod: "CASH",
    },
    update: {},
  });

  await prisma.offer.upsert({
    where: { id: "seed-offer-family" },
    create: {
      id: "seed-offer-family",
      name: "Forfait fratrie / famille",
      kind: "FAMILY_BUNDLE",
      rules: JSON.stringify({
        minMembers: 2,
        requiresHousehold: true,
        bundlePriceCents: 80000,
      }),
      isActive: true,
    },
    update: {},
  });

  await prisma.offer.upsert({
    where: { id: "seed-offer-second" },
    create: {
      id: "seed-offer-second",
      name: "2e discipline -15%",
      kind: "SECOND_DISCIPLINE",
      rules: JSON.stringify({ percentOff: 15 }),
      isActive: true,
    },
    update: {},
  });

  console.log("Done. Login: admin@gym.local / admin1234");
  console.log("Enrollment: /enrollment | Check-in: /attendance/today");
  console.log(`Plans: ${planBjj.name}, ${planKarate.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
