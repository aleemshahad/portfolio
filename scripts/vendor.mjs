#!/usr/bin/env node
/**
 * vendor.mjs — copy GSAP out of node_modules into assets/vendor/ so the
 * page never talks to a CDN at runtime. Run after `npm install` only;
 * the committed copies in assets/vendor/ are what ships.
 */

import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAIRS = [
  ["node_modules/gsap/dist/gsap.min.js", "assets/vendor/gsap.min.js"],
  ["node_modules/gsap/dist/ScrollTrigger.min.js", "assets/vendor/ScrollTrigger.min.js"],
];

let copied = 0;
for (const [from, to] of PAIRS) {
  const src = join(ROOT, from);
  if (!existsSync(src)) {
    console.error(`[vendor] missing ${from} — run: npm install`);
    process.exitCode = 1;
    continue;
  }
  const dst = join(ROOT, to);
  await mkdir(dirname(dst), { recursive: true });
  await copyFile(src, dst);
  copied += 1;
  console.log(`[vendor] ${from} -> ${to}`);
}
console.log(`[vendor] ${copied}/${PAIRS.length} files copied`);
