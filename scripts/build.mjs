import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(resolve(root, "index.html"), resolve(dist, "index.html"));
await cp(resolve(root, "src"), resolve(dist, "src"), { recursive: true });
await cp(resolve(root, "manifest.webmanifest"), resolve(dist, "manifest.webmanifest"));
await cp(resolve(root, "sw.js"), resolve(dist, "sw.js"));
await cp(resolve(root, "icons"), resolve(dist, "icons"), { recursive: true });

console.log("Built static Talent Portal to dist/");
