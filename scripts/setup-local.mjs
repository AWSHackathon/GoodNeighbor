import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { spawnSync } from "node:child_process";

const root = join(import.meta.dirname, "..");
const isAmplifyCi = Boolean(process.env.AWS_APP_ID);
const amplifyDir = join(root, "amplify");
const envExample = join(root, ".env.example");
const envLocal = join(root, ".env.local");
const outputsExample = join(root, "amplify_outputs.example.json");
const outputsLocal = join(root, "amplify_outputs.json");

if (isAmplifyCi) {
  console.log(
    "Amplify CI build — skipping local setup (.env.local, placeholder amplify_outputs).",
  );
  process.exit(0);
}

if (existsSync(join(amplifyDir, "package.json"))) {
  console.log("Installing Amplify backend dependencies (amplify/)…");
  const install = spawnSync("npm", ["install", "--prefix", amplifyDir], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  if (install.status !== 0) {
    console.warn("amplify/ npm install failed — run: npm install --prefix amplify");
  }
}

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

function getApiEndpointFromOutputs() {
  if (!existsSync(outputsLocal)) return null;
  try {
    const outputs = JSON.parse(readFileSync(outputsLocal, "utf8"));
    const api = outputs?.custom?.API;
    if (!api || typeof api !== "object") return null;
    const first = Object.values(api)[0];
    const endpoint = first?.endpoint;
    if (typeof endpoint !== "string" || endpoint.includes("REPLACE")) {
      return null;
    }
    return endpoint.replace(/\/$/, "");
  } catch {
    return null;
  }
}

const apiEndpoint = getApiEndpointFromOutputs();
const localMockLine = "NEXT_PUBLIC_LOCAL_API_URL=http://127.0.0.1:3000/api";

function upsertEnvLine(env, key, value) {
  const line = `${key}=${value}`;
  if (new RegExp(`^${key}=`, "m").test(env)) {
    return env.replace(new RegExp(`^${key}=.*$`, "m"), line);
  }
  return `${env.trimEnd()}\n${line}\n`;
}

if (existsSync(envLocal)) {
  let env = readFileSync(envLocal, "utf8");
  env = upsertEnvLine(env, "NEXT_PUBLIC_LOCAL_API_URL", "http://127.0.0.1:3000/api");
  if (apiEndpoint) {
    env = upsertEnvLine(env, "NEXT_PUBLIC_API_URL", apiEndpoint);
    writeFileSync(envLocal, env);
    console.log("Set NEXT_PUBLIC_API_URL from amplify_outputs.json (deployed API)");
    console.log("Set NEXT_PUBLIC_LOCAL_API_URL for /api/leaderboard mock");
  } else {
    writeFileSync(envLocal, env);
    console.log("Set NEXT_PUBLIC_LOCAL_API_URL for /api mock routes");
  }
}

console.log("\nLocal dev:");
console.log("  npm run dev");
console.log("  http://127.0.0.1:3000");
console.log("\nPhase 1 auth + API:");
console.log("  npx ampx sandbox secret set GOOGLE_CLIENT_ID");
console.log("  npx ampx sandbox secret set GOOGLE_CLIENT_SECRET");
console.log("  npm run sandbox");
console.log("\nAmazon Location map:");
console.log("  Set NEXT_PUBLIC_AMAZON_LOCATION_API_KEY in .env.local, or");
console.log("  npm run sandbox  # deploys Cognito + DynamoDB + HTTP API + map");
