import { build } from "esbuild";

await build({
  entryPoints: ["workers/security.ts"],
  bundle: true,
  outfile: "out/security-worker.mjs",
  format: "esm",
  platform: "browser",
  target: "es2022",
  conditions: ["react-server"],
  external: ["node:crypto"],
});
console.log(
  "Built the portable security API Worker (no deployment performed).",
);
