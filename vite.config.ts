import path from "node:path";
import type { Plugin } from "vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import devtoolsJson from "vite-plugin-devtools-json";
import tailwindcss from "@tailwindcss/vite";
import babel from "vite-plugin-babel";

// Prisma 7 generates ?module WASM imports (Cloudflare Workers syntax).
// Vite can't parse them — mark them external so wrangler handles them instead.
const cloudflareWasmModule: Plugin = {
  name: "cloudflare-wasm-module",
  enforce: "pre",
  resolveId(id) {
    if (id.includes(".wasm") && id.endsWith("?module")) {
      return {
        id: "../../app/db/internal/query_compiler_fast_bg.wasm?module",
        external: true,
      };
    }
  },
};

export default defineConfig((config) => {
  const env = loadEnv(config.mode, process.cwd(), "");

  return {
    resolve: {
      alias:
        config.mode === "development"
          ? {
              "~/db.server": path.resolve(
                process.cwd(),
                "app/db.local.server.ts",
              ),
            }
          : undefined,
    },
    ssr: {
      resolve: {
        conditions: ["workerd", "browser"],
        externalConditions: ["workerd", "browser"],
      },
    },
    server: {
      port: 3001,
    },
    plugins: [
      cloudflareWasmModule,
      tailwindcss(),
      reactRouter(),
      tsconfigPaths(),
      devtoolsJson(),
      babel({
        filter: /app\/.*\.[jt]sx?$/,
        babelConfig: {
          presets: ["@babel/preset-typescript"],
          plugins: [["babel-plugin-react-compiler"]],
        },
      }),
    ],
  };
});
