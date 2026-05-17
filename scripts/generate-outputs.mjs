/**
 * Download amplify_outputs.json for a deployed Amplify branch (local dev against prod).
 *
 * Usage:
 *   npm run generate:outputs -- <amplify-app-id> [branch]
 *   AMPLIFY_APP_ID=d1234 npm run generate:outputs
 */
import { spawnSync } from "node:child_process";

const appId = process.argv[2] ?? process.env.AMPLIFY_APP_ID;
const branch = process.argv[3] ?? process.env.AWS_BRANCH ?? "main";

if (!appId) {
  console.error(
    "Missing Amplify app id.\n\n  npm run generate:outputs -- <app-id> [branch]\n\nFind app id: Amplify Console → App settings → General.",
  );
  process.exit(1);
}

const result = spawnSync(
  "npx",
  ["ampx", "generate", "outputs", "--app-id", appId, "--branch", branch],
  { stdio: "inherit", shell: true },
);

process.exit(result.status ?? 1);
