// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

function readPublicEnvFile(fileName: string): Map<string, string> {
  const filePath = resolve(process.cwd(), fileName);
  const values = new Map<string, string>();

  if (!existsSync(filePath)) {
    return values;
  }

  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();

    if (!key.startsWith("VITE_")) {
      continue;
    }

    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values.set(key, value);
  }

  return values;
}

function getDevVarsFallbackDefine(): Record<string, string> {
  const viteEnvKeys = new Set([
    ...readPublicEnvFile(".env").keys(),
    ...readPublicEnvFile(".env.local").keys(),
  ]);
  const devVars = readPublicEnvFile(".dev.vars");
  const define: Record<string, string> = {};

  for (const [key, value] of devVars) {
    if (process.env[key] || viteEnvKeys.has(key)) {
      continue;
    }

    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return define;
}

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    // Wrangler reads .dev.vars for the worker. Vite does not, so expose only
    // public VITE_* keys to the browser bundle as a local-dev fallback.
    define: getDevVarsFallbackDefine(),
  },
});
