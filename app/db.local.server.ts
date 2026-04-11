import { PrismaClient } from "./db/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

declare global {
  var __prisma: PrismaClient | undefined;
  var __authPrisma: PrismaClient | undefined;
}

export function getPrisma(_context: unknown): PrismaClient {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      adapter: new PrismaLibSql({
        url: process.env.DATABASE_URL ?? "file:./dev.db",
      }),
    });
  }
  return global.__prisma;
}

// In local dev, auth tables live in the same dev.db
export function getAuthPrisma(_context: unknown): PrismaClient {
  if (!global.__authPrisma) {
    global.__authPrisma = new PrismaClient({
      adapter: new PrismaLibSql({
        url: process.env.DATABASE_URL ?? "file:./dev.db",
      }),
    });
  }
  return global.__authPrisma;
}
