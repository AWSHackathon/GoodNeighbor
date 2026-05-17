# Deploy Good Neighbor to AWS (Amplify Gen 2)

Full-stack hosting: **Amplify Hosting** (Next.js) + **Cognito**, **Lambda**, **DynamoDB**, **Amazon Location** (defined in `amplify/`).

## Prerequisites

- AWS account with permission to create Amplify apps (e.g. `AmplifyBackendDeployFullAccess`)
- GitHub repo: `https://github.com/AWSHackathon/GoodNeighbor`
- Node.js 20+ locally (for sandbox / secrets)
- Google OAuth Web client ([Google Cloud Console](https://console.cloud.google.com/apis/credentials))

## Phase A — Connect Amplify Hosting (one time)

1. Open [Amplify Console](https://console.aws.amazon.com/amplify/home) → **Create new app** → **Host web app**.
2. Choose **GitHub** → authorize → select **AWSHackathon/GoodNeighbor** → branch **`main`**.
3. App name: e.g. `good-neighbor`. Review build settings — Amplify should detect **`amplify.yml`** at repo root.
4. **Advanced settings** → ensure build image supports **Node 20** (or set `NODE_VERSION=20` under Environment variables).
5. **Save and deploy** (first build ~10–15 min). Backend deploys first, then frontend.

When the build finishes, copy the app URL, e.g. `https://main.d1234abcd.amplifyapp.com`.

## Phase B — Secrets (Google sign-in)

Sandbox secrets do **not** apply to branch deploys. Set them in the console:

1. Amplify app → **Hosting** → **Secrets** → **Manage secrets**.
2. Add for branch **`main`** (or “All branches”):

   | Secret name | Value |
   |-------------|--------|
   | `GOOGLE_CLIENT_ID` | From Google Cloud OAuth client |
   | `GOOGLE_CLIENT_SECRET` | From Google Cloud OAuth client |

3. Push any commit to `main` (or **Redeploy this version**) so the backend picks up secrets.

## Phase C — Production OAuth redirect URLs

After you have the Amplify app URL:

1. **Amplify Console** → **Hosting** → **Environment variables** (branch `main`):

   ```
   AMPLIFY_AUTH_CALLBACK_URLS=https://main.<your-app-id>.amplifyapp.com/login
   AMPLIFY_AUTH_LOGOUT_URLS=https://main.<your-app-id>.amplifyapp.com/
   ```

2. **Google Cloud Console** → your OAuth client:
   - **Authorized JavaScript origins:** `https://main.<app-id>.amplifyapp.com`
   - **Authorized redirect URIs:** Cognito IdP URL (see below)

3. Get Cognito redirect URI from Amplify:
   - **Deployments** → `main` → **Deployed backend resources** → download **`amplify_outputs.json`**
   - Use `auth.oauth.domain`:  
     `https://<domain>/oauth2/idpresponse`

4. Commit/push (or redeploy) so `amplify/auth/urls.ts` env vars apply to Cognito.

## Phase D — Maps and geocode (optional but recommended)

For map tiles without relying only on signed-in Amplify Geo:

1. Create an **Amazon Location** API key with **Maps** (and Places if using geocode routes).
2. In Amplify **Environment variables** for `main`:

   ```
   NEXT_PUBLIC_AMAZON_LOCATION_API_KEY=<key>
   NEXT_PUBLIC_AWS_REGION=us-west-2
   AMAZON_LOCATION_API_KEY=<key>
   ```

   (`AMAZON_LOCATION_API_KEY` is server-side for `app/api/location/*` routes.)

## Phase E — Smoke test

1. Open production URL → **Sign in** (Google or email).
2. **`/map`** — list/create requests (fix locally first if still flaky).
3. Respond → accept → thread → fulfill → Gratitude Board updates.

## Local vs production

| | Local | Amplify `main` |
|---|--------|----------------|
| Backend | `npm run sandbox` | `pipeline-deploy` in CI |
| Config | `amplify_outputs.json` (gitignored) | Generated during build |
| OAuth callbacks | localhost / 127.0.0.1 | + env vars in Phase C |
| Google secrets | `npx ampx sandbox secret set …` | Amplify Console Secrets |

Download production `amplify_outputs.json` from the console to debug locally against the **same** backend (optional).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build fails on `amplify_outputs` / REPLACE | Ensure `amplify.yml` backend phase runs; do not commit placeholder `amplify_outputs.json`. |
| Google login redirect error | Phase C URLs + Google redirect URI for Cognito domain. |
| API 401 / CORS | Sign out/in; confirm `amplify_outputs` matches deployed branch. |
| Map blank | Set Location API key env vars or sign in for Amplify Geo. |

## Git workflow after deploy

```bash
git pull --rebase origin main
# make changes
git push origin main
```

Each push to `main` triggers a fullstack redeploy.
