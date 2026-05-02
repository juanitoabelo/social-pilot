import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: ["error"],
});

// Suppress Neon serverless disconnect noise
prisma.$on("error", (e) => {
  if (e.message?.includes("terminating connection")) return;
});