import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.ADMIN_NAME?.trim() || "Admin";
const password = process.env.ADMIN_PASSWORD?.trim();

if (!email || !password) {
  console.error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  process.exit(1);
}

if (password.length < 8) {
  console.error("ADMIN_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 10);

const user = await prisma.user.upsert({
  where: { email },
  update: {
    name,
    role: "ADMIN",
    isActive: true,
    passwordHash,
  },
  create: {
    email,
    name,
    role: "ADMIN",
    isActive: true,
    passwordHash,
  },
  select: { id: true, email: true, name: true, role: true },
});

await prisma.auditLog.create({
  data: {
    action: "ADMIN_BOOTSTRAPPED",
    entityType: "User",
    entityId: user.id,
    details: JSON.stringify({ email: user.email }),
  },
});

await prisma.$disconnect();

console.log(`Admin ready: ${user.email}`);
