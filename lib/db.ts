import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** The Prisma client, or null when DATABASE_URL is not set (pages then show empty states). */
export function db(): PrismaClient | null {
  const url = env().DATABASE_URL;
  if (!url) return null;
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }
  return globalForPrisma.prisma;
}

/** Same as db() but throws when the database is not configured. For writes and API routes. */
export function requireDb(): PrismaClient {
  const client = db();
  if (!client) throw new Error("DATABASE_URL is not set");
  return client;
}
