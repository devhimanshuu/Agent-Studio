/**
 * Cross-platform `npm run build` entry.
 *
 * Forces NODE_ENV=production before invoking `next build`. A globally-set
 * NODE_ENV=development (common in dev shells/IDEs) makes Next.js's error-page
 * prerendering throw "<Html> should not be imported outside of pages/_document"
 * during `next build` — an upstream quirk documented in vercel/next.js#77262.
 * This wrapper guarantees a production build regardless of the caller's env.
 */
process.env.NODE_ENV = "production";

const { spawn } = require("child_process");
const path = require("path");

const nextBin = path.join(__dirname, "..", "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
