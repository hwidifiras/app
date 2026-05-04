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
  console.log("🌱 Seeding test data for check-in validation...");

  const adminEmail = (process.env.SEED_ADMIN_EMAIL?.trim() || "admin@gym.local").toLowerCase();
  const adminName = process.env.SEED_ADMIN_NAME?.trim() || "Admin";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD?.trim() || "admin1234";

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } }).catch(() => null);
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const created = await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        role: "ADMIN",
        passwordHash,
        isActive: true,
      },
      select: { id: true, email: true },
    });
    console.log("✅ Admin user created:", created.email);
  } else {
    console.log("ℹ️ Admin user already exists:", adminEmail);
  }

  // 1. Create a member
  const member = await prisma.member.create({
    data: {
      firstName: "Karim",
      lastName: "Test",
      phone: "06-12-34-56-78",
      email: "karim.test@example.com",
      status: "ACTIVE",
    },
  });
  console.log("✅ Member created:", member.id);

  // 2. Create a sport
  const sport = await prisma.sport.create({
    data: {
      name: "Fitness Test",
      description: "Sport de test pour validation",
      isActive: true,
    },
  });
  console.log("✅ Sport created:", sport.id);

  // 3. Create a coach
  const coach = await prisma.coach.create({
    data: {
      firstName: "Ahmed",
      lastName: "Coach",
      phone: "06-87-65-43-21",
      email: "ahmed.coach@example.com",
      sportId: sport.id,
      isActive: true,
    },
  });
  console.log("✅ Coach created:", coach.id);

  // 4. Create a group
  const group = await prisma.group.create({
    data: {
      name: "Groupe Soir Test",
      sportId: sport.id,
      coachId: coach.id,
      capacity: 20,
      room: "Salle A",
      isActive: true,
    },
  });
  console.log("✅ Group created:", group.id);

  // 5. Add member to group
  await prisma.groupMember.create({
    data: {
      groupId: group.id,
      memberId: member.id,
      startDate: new Date(),
      status: "ACTIVE",
    },
  });
  console.log("✅ GroupMember created");

  // Use current day of week so the session shows up in /attendance/today
  const now = new Date();
  const todayDayOfWeek = dayOfWeekValues[now.getDay()];
  const startTime = "18:00";
  const durationMinutes = 90;

  // 6. Create group schedule for TODAY's day of week
  await prisma.groupSchedule.create({
    data: {
      groupId: group.id,
      dayOfWeek: todayDayOfWeek,
      startTime,
      durationMinutes,
    },
  });
  console.log("✅ GroupSchedule created for", todayDayOfWeek, startTime);

  // 7. Create session for TODAY
  const tz = process.env.APP_TIMEZONE?.trim() || "Africa/Tunis";
  const today = utcDateOnlyForTimeZone(new Date(), tz);

  const session = await prisma.session.create({
    data: {
      groupId: group.id,
      coachId: coach.id,
      sessionDate: today,
      startTime,
      endTime: "19:30",
      room: "Salle A",
      status: "PLANNED",
    },
  });
  console.log("✅ Session created for today:", session.id, "date:", today.toISOString().split("T")[0]);

  // 8. Create subscription plan (session-based)
  const plan = await prisma.subscriptionPlan.create({
    data: {
      name: "Plan Test 12 séances",
      description: "12 séances par mois, 3 par semaine max",
      price: 50000, // 500 EUR in cents
      totalSessions: 12,
      sessionsPerWeek: 3,
      validityDays: 30,
      isActive: true,
    },
  });
  console.log("✅ SubscriptionPlan created:", plan.id);

  // 9. Create member subscription (ACTIVE with remaining sessions)
  const subscription = await prisma.memberSubscription.create({
    data: {
      memberId: member.id,
      planId: plan.id,
      startDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), // started 7 days ago
      endDate: new Date(today.getTime() + 23 * 24 * 60 * 60 * 1000),  // ends in 23 days
      amount: 50000,
      remainingSessions: 10,
      status: "ACTIVE",
    },
  });
  console.log("✅ MemberSubscription created:", subscription.id, "remaining:", subscription.remainingSessions);

  console.log("\n🎉 Seed complete! Go to http://localhost:3000/attendance/today to test check-in.");
  console.log("   Member:", `${member.firstName} ${member.lastName}`);
  console.log("   Group:", group.name);
  console.log("   Session:", `${today.toISOString().split("T")[0]} ${session.startTime}-${session.endTime}`);
  console.log("   Subscription:", `${plan.name} — ${subscription.remainingSessions} séances restantes`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
