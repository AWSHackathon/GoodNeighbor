import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const envExample = join(root, ".env.example");
const envLocal = join(root, ".env.local");
const outputsExample = join(root, "amplify_outputs.example.json");
const outputsLocal = join(root, "amplify_outputs.json");

if (!existsSync(envLocal) && existsSync(envExample)) {
  copyFileSync(envExample, envLocal);
  console.log("Created .env.local from .env.example");
} else if (existsSync(envLocal)) {
  console.log(".env.local already exists — skipped");
} else {
  console.warn("No .env.example found — create .env.local manually if needed");
}

if (!existsSync(outputsLocal) && existsSync(outputsExample)) {
  copyFileSync(outputsExample, outputsLocal);
  console.log(
    "Created amplify_outputs.json from amplify_outputs.example.json (run npm run sandbox for live values)",
  );
}

console.log("\nLocal dev:");
console.log("  npm run dev");
console.log("  http://127.0.0.1:3000");
console.log("\nAmazon Location map:");
console.log("  Set NEXT_PUBLIC_AMAZON_LOCATION_API_KEY in .env.local, or");
console.log("  npm run sandbox  # deploys Cognito + GoodNeighborMap");
