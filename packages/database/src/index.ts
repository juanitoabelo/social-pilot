import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const isNeonDisconnect = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.message.includes("terminating connection due to administrator command");
  }
  return false;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn"] : [],
    errorFormat: "minimal",
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Warm up connection on startup (handles Neon cold start)
if (process.env.NODE_ENV === "development") {
  prisma.$connect().catch((e) => {
    if (!isNeonDisconnect(e)) console.error("Prisma startup error:", e);
  });
}

export default prisma;

// Re-export Prisma error for type checking
export { Prisma };
