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

// Suppress Neon serverless disconnect noise
prisma.$on("error", (e) => {
  if (e.message?.includes("terminating connection")) return;
});

// Warm up connection on startup (handles Neon cold start)
if (process.env.NODE_ENV === "development") {
  prisma.$connect().catch(() => {
    // Connection will retry on first query
  });
}

export default prisma;