import type { MiddlewareFunction } from "react-router";
import { createContext } from "react-router";
import type { UserModel as User } from "~/db/models";
import { getAuthPrisma } from "~/db.server";
import { getAuth } from "~/domain/auth/better-auth.server";

export const userContext = createContext<User | null>(null);

export const getOptionalUserFromContext = (context: any): User | null => {
  return context.get(userContext) ?? null;
};

export const globalStorageMiddleware: MiddlewareFunction<Response> = async (
  { request, context },
  next,
) => {
  const db = getAuthPrisma(context);
  let user: User | null = null;

  try {
    const auth = getAuth(context);
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (session?.user?.id) {
      user = await db.user.findUnique({ where: { id: session.user.id } });
    }
  } catch {
    // No session — guests are welcome
  }

  context.set(userContext, user);
  return next();
};
