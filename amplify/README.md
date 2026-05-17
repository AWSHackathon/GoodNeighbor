# Amplify Gen 2 backend

## Resources

| Resource | Purpose |
|----------|---------|
| `auth/resource.ts` | Cognito User Pool — **Google OAuth** (primary) + **email** |
| `backend.ts` | DynamoDB `GoodNeighbor` table, HTTP API + Lambda, Amazon Location map |
| `functions/api/` | Lambda handler — **Phase 1:** `GET/PUT /profiles/me` |

## Deploy (personal sandbox)

From the repo root (AWS credentials required):

### 1. Google OAuth secrets

Create a [Google OAuth Web client](https://console.cloud.google.com/apis/credentials), then:

```bash
npx ampx sandbox secret set GOOGLE_CLIENT_ID
npx ampx sandbox secret set GOOGLE_CLIENT_SECRET
```

After the first sandbox deploy, add this **Authorized redirect URI** in Google Cloud Console (replace region/domain if different):

```text
https://good-neighbor-hack2026.auth.<region>.amazoncognito.com/oauth2/idpresponse
```

Find the exact domain in the Cognito console or `amplify_outputs.json` → `auth.oauth.domain`.

### 2. Deploy

```bash
npm run sandbox
```

This writes `amplify_outputs.json` and updates `.env.local` with `NEXT_PUBLIC_API_URL` (via `npm run setup`).

### 3. Local app

```bash
npm run dev
```

Open [http://127.0.0.1:3000/login](http://127.0.0.1:3000/login) — sign in with Google or email. Profiles are stored in DynamoDB (`USER#<sub>` / `PROFILE`).

## API (authenticated)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/profiles/me` | Load or create profile from JWT claims |
| PUT | `/profiles/me` | Update displayName, neighborhood, zipCode, lat/lng |

Use the Cognito **ID token** in `Authorization: Bearer <token>`.

## Email-only (skip Google temporarily)

Comment out `google` and `externalProviders` in `auth/resource.ts` if secrets are not ready; email sign-up still works.

## Map

Guest and authenticated IAM roles can call `geo:GetMap*` on **GoodNeighborMap**. Or use an Amazon Location API key in `.env.local` (see root README).

## Production deploy (Amplify Hosting)

Branch deploys use **`amplify.yml`** at the repo root (`npx ampx pipeline-deploy` in CI).

1. Connect **GitHub → main** in the [Amplify Console](https://console.aws.amazon.com/amplify/home).
2. Set **Secrets** (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) for branch `main` — not sandbox secrets.
3. After first deploy, set env vars `AMPLIFY_AUTH_CALLBACK_URLS` and `AMPLIFY_AUTH_LOGOUT_URLS` (see `amplify/auth/urls.ts`).

Full checklist: [docs/DEPLOY.md](../docs/DEPLOY.md).
