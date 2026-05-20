import { PrismaClient } from "@prisma/client";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/check-user-email.mjs <email>");
  process.exit(1);
}

const prisma = new PrismaClient();
const user = await prisma.user.findUnique({
  where: { email },
  select: { id: true, email: true, name: true, role: true, isActive: true },
});
console.log(JSON.stringify(user, null, 2));
await prisma.$disconnect();
