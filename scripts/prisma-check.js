require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("DATABASE_URL:", process.env.DATABASE_URL);

  const tables = await prisma.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;",
  );
  console.log("Tables:", tables);

  try {
    const users = await prisma.$queryRawUnsafe(
      "SELECT id, email, role, isActive FROM User;",
    );
    console.log("Users (raw):", users);
  } catch (err) {
    console.error("User query failed:", err.message || err);
  }

  try {
    const users = await prisma.user.findMany({
      select: { email: true, isActive: true, role: true },
    });
    console.log("Users (client):", users);
  } catch (err) {
    console.error("Prisma client error:", err.message || err);
  }
}

main()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
