import { PrismaClient } from "./db/client";
import { PrismaD1 } from "@prisma/adapter-d1";

let cachedPrisma: PrismaClient | null = null;
let cachedD1: unknown = null;

export function getPrisma(context: any): PrismaClient {
  if (!context?.cloudflare?.env?.D1_DATABASE) {
    throw new Error(
      "getPrisma: D1_DATABASE binding not found. Run via `wrangler dev` or check your Cloudflare environment.",
    );
  }
  const d1 = context.cloudflare.env.D1_DATABASE;
  if (cachedPrisma && cachedD1 === d1) {
    return cachedPrisma;
  }
  const adapter = new PrismaD1(d1);
  cachedPrisma = new PrismaClient({ adapter });
  cachedD1 = d1;
  return cachedPrisma;
}

let cachedAuthPrisma: PrismaClient | null = null;
let cachedAuthD1: unknown = null;

export function getAuthPrisma(context: any): PrismaClient {
  if (!context?.cloudflare?.env?.AUTH_DB) {
    throw new Error(
      "getAuthPrisma: AUTH_DB binding not found. Run via `wrangler dev` or check your Cloudflare environment.",
    );
  }
  const d1 = context.cloudflare.env.AUTH_DB;
  if (cachedAuthPrisma && cachedAuthD1 === d1) {
    return cachedAuthPrisma;
  }
  const adapter = new PrismaD1(d1);
  cachedAuthPrisma = new PrismaClient({ adapter });
  cachedAuthD1 = d1;
  return cachedAuthPrisma;
}
