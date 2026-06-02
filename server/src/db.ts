import { PrismaClient } from "@prisma/client";

export const prisma = process.env.DATABASE_URL ? new PrismaClient() : null;

export async function disconnectDb() {
  if (prisma) await prisma.$disconnect();
}
