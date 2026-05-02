import { PrismaClient } from "@prisma/client";

const isNeonDisconnect = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.message.includes("terminating connection due to administrator command");
  }
  return false;
};

export const prisma = new PrismaClient({
  log: [],
  errorFormat: "minimal",
});

prisma.$connect().catch((e) => {
  if (!isNeonDisconnect(e)) console.error("Worker Prisma startup error:", e);
});
