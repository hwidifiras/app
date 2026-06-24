/* eslint-disable @typescript-eslint/no-require-imports */

require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("DATABASE_URL:", process.env.DATABASE_URL);

  const tables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  console.log("Tables:", tables);

  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true, name: true, status: true },
    orderBy: { createdAt: "asc" },
  });
  console.log("Tenants:", tenants);

  const users = await prisma.user.findMany({
    select: { tenantId: true, email: true, isActive: true, role: true },
    orderBy: { createdAt: "asc" },
  });
  console.log("Users:", users);
}

main()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
