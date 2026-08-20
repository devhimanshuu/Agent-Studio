
/* eslint-disable @typescript-eslint/no-require-imports */
process.env.NODE_ENV = "production";

const { spawn } = require("child_process");
const path = require("path");

let nextBin;
try {
  nextBin = require.resolve("next/dist/bin/next");
} catch {
  nextBin = path.join(__dirname, "..", "node_modules", "next", "dist", "bin", "next");
}

const child = spawn(process.execPath, [nextBin, "build"], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
