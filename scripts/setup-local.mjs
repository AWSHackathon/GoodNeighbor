import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const envExample = join(root, ".env.example");
const envLocal = join(root, ".env.local");

if (!existsSync(envLocal) && existsSync(envExample)) {
  copyFileSync(envExample, envLocal);
  console.log("Created .env.local from .env.example");
} else if (existsSync(envLocal)) {
  console.log(".env.local already exists — skipped");
} else {
  console.warn("No .env.example found — create .env.local manually if needed");
}

console.log("\nLocal dev:");
console.log("  npm run dev");
console.log("  http://127.0.0.1:3000");
