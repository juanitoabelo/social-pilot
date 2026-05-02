// Re-export Prisma client from database package
// This allows the web app to import from a local path while using the shared package

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: [
      {
        url: { env: "DATABASE_URL" },
      },
    ],
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Handle Neon serverless disconnects gracefully
prisma.$on("error", (e) => {
  // Suppress "terminating connection due to administrator command" noise
  if (e.message?.includes("terminating connection")) return;
});

export default prisma;