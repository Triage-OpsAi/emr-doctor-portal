import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig} */
export default function nextConfig(phase) {
  return {
    output: "standalone",
    poweredByHeader: false,
    // Keep development artifacts isolated from `next build`. Running a build
    // while the dev server is open must never corrupt its dynamic route table.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    turbopack: {
      root: path.dirname(fileURLToPath(import.meta.url)),
    },
  };
}
