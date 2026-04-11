import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("robots.txt", "routes/robots[.]txt.ts"),
  route("sitemap.xml", "routes/sitemap[.]xml.ts"),
  route("game/:gameId", "routes/game.$gameId.tsx"),

  // Auth routes
  route("api/auth/*", "routes/api/auth.ts"),
  route("api/game", "routes/api/game.ts"),
  route("login", "routes/auth/login.tsx"),
  route("signup", "routes/auth/signup.tsx"),
  route("logout", "routes/auth/logout.ts"),
  route("profile", "routes/profile.tsx"),
] satisfies RouteConfig;
