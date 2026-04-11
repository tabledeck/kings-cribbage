import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { getAuthPrisma } from "~/db.server";

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = "SHA-256";
const PBKDF2_KEY_LEN = 32;

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function pbkdf2Key(
  password: string,
  salt: Uint8Array,
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: PBKDF2_HASH,
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    PBKDF2_KEY_LEN * 8,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await pbkdf2Key(password, salt);
  return `${toHex(salt.buffer)}:${toHex(bits)}`;
}

export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  const [saltHex, keyHex] = hash.split(":");
  if (!saltHex || !keyHex) return false;
  const salt = new Uint8Array(
    saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
  );
  const bits = await pbkdf2Key(password, salt);
  const target = new Uint8Array(bits);
  const stored = new Uint8Array(
    keyHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
  );
  if (target.length !== stored.length) return false;
  let diff = 0;
  for (let i = 0; i < target.length; i++) diff |= target[i] ^ stored[i];
  return diff === 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedAuth: any = null;
let cachedEnvRef: unknown = null;

export function getAuth(context: any) {
  const env = context?.cloudflare?.env ?? process.env;

  if (cachedAuth && cachedEnvRef === env) {
    return cachedAuth;
  }

  const db = getAuthPrisma(context);
  const isProduction = env.ENVIRONMENT !== "development";
  const secret =
    (env as any).BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET;

  const auth = betterAuth({
    baseURL: isProduction ? "https://kingscrib.tabledeck.us" : "http://localhost:3001",
    basePath: "/api/auth",
    secret,
    trustedOrigins: isProduction
      ? ["https://tabledeck.us", "https://*.tabledeck.us"]
      : ["http://localhost:3000", "http://localhost:3001"],
    advanced: {
      cookiePrefix: "tabledeck",
      useSecureCookies: isProduction,
      crossSubDomainCookies: {
        enabled: isProduction,
        domain: isProduction ? ".tabledeck.us" : undefined,
      },
      ...((context as any)?.cloudflare?.ctx
        ? {
            backgroundTasks: {
              handler: (promise: Promise<unknown>) => {
                (context as any).cloudflare.ctx.waitUntil(promise);
              },
            },
          }
        : {}),
    },
    database: prismaAdapter(db, {
      provider: "sqlite",
      transaction: false,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      password: {
        hash: hashPassword,
        verify: ({ hash, password }) => verifyPassword(hash, password),
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 90,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },
  });

  cachedAuth = auth;
  cachedEnvRef = env;
  return auth;
}

export type BetterAuthSession = NonNullable<
  Awaited<ReturnType<ReturnType<typeof getAuth>["api"]["getSession"]>>
>;
