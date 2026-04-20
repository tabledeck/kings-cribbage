import type { Config } from "@react-router/dev/config";

export default {
  future: {
    v8_middleware: true,
  },
  ssr: true,
  buildDirectory: "dist",
  serverBuildFile: "index.js",
} satisfies Config;
