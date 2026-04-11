/// <reference types="@cloudflare/workers-types" />

export {};

declare global {
  interface Env {
    D1_DATABASE: D1Database;
    AUTH_DB: D1Database;
    GAME_ROOM: DurableObjectNamespace;
    ENVIRONMENT: string;
    BETTER_AUTH_SECRET: string;
  }
}

declare module "react-router" {
  interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}
