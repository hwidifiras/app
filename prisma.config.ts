import { defineConfig } from "prisma/config";
export default defineConfig({ schema: "prisma/schema.prisma", engine: "classic", datasource: { url: process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/all_in_gym?replicaSet=allInGymLocal" } });
