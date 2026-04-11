import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { getAuth } from "~/domain/auth/better-auth.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = getAuth(context);
  await auth.api.signOut({ headers: request.headers });
  throw redirect("/");
}
