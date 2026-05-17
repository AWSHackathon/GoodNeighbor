# Good Neighbor

**AWSHackathon2026-GoodNeighbor** — AWS Hackathon 2026 neighborhood assistance map. Sign in with Google, see nearby help requests on a map centered on your location, respond to neighbors, and coordinate meet-ups privately after you accept an offer.

## Location

The map centers on the user’s area—no fixed demo neighborhood. Resolution order: **device GPS** (browser permission) → **IP geolocation** → **manual ZIP** if GPS is denied or IP is wrong. Details are in [docs/PLAN.md](docs/PLAN.md#location-resolution).

**Gratitude Board:** The bottom half of `/map` celebrates neighbors by **requests completed** and **hours contributed**, scoped to your area. Use the dropdown to switch **All time** vs **This week**; data refreshes when your neighborhood changes. See [docs/PLAN.md — Leaderboard](docs/PLAN.md#leaderboard) (API path unchanged).

**Privacy:** Neighbors never see your exact home pin or full address on the map. Request pins use a **buffer zone** (Marketplace-style approximate area). Optional **meeting place** hints stay vague publicly; exact location is shared only in a **private thread** after the requester accepts a helper. See [docs/PLAN.md — Location privacy](docs/PLAN.md#location-privacy).

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS |
| Auth | AWS Cognito (**Google OAuth primary**, email sign-up/sign-in) |
| API | AWS Lambda + API Gateway |
| Database | Amazon DynamoDB |
| Maps / geo | Amazon Location Service (map, Places, IP geolocation) |
| Backend & hosting | AWS Amplify Gen 2, Amplify Hosting |

## Project status

**Where we are (May 2026):** Core MVP is **implemented on `main`** but **local end-to-end is broken** for help requests — the map and forms are wired, yet `GET/POST /requests` often fail until sandbox, auth, and env are aligned.

| Done | In progress / broken |
|------|----------------------|
| Cognito auth (Google + email), profiles API | **Creating and listing posts** via deployed API |
| Lambda routes: requests, respond, accept, thread, fulfill, leaderboard | Stable geofence + pin refresh after create |
| `/map` UI: Amazon Location tiles, pin pick, request list, leaderboard panel | Amplify Hosting production deploy |

**Immediate fix path:** run sandbox, `npm run setup`, restart dev, **sign out and sign in**, then test `/map`. Details and phase rollup: [docs/PLAN.md — Current status](docs/PLAN.md#current-status-may-2026).

See [docs/PLAN.md](docs/PLAN.md) for architecture and phase definitions.

## Prerequisites

- Node.js 20+
- npm
- AWS account (for Phase 1+)
- [AWS Amplify CLI](https://docs.amplify.aws/react/reference/cli-commands/) (`npm install -g @aws-amplify/backend-cli`)

## Local development

```bash
npm run setup   # install deps + create .env.local from .env.example
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). You need a **running sandbox** and a **fresh sign-in** after each deploy.

### Two terminals (required for requests)

```bash
# Terminal 1 — backend (keep running)
npm run sandbox

# Terminal 2 — frontend (after sandbox writes amplify_outputs.json)
npm run setup
rm -rf .next
npm run dev
```

Then sign out → sign in → `/map`. If you see a red **API:** banner, read the error text; usually auth or sandbox, not a full redeploy. See [docs/PLAN.md — Local dev checklist](docs/PLAN.md#local-dev-checklist-when-api-or-posts-fail).

Mock API (leaderboard only): `GET http://127.0.0.1:3000/api/leaderboard?neighborhood=capitol-hill&period=all`

### Amazon Location map

The `/map` screen uses **MapLibre GL** with **Amazon Location Service** tiles (not OpenStreetMap).

1. **API key:** Set `NEXT_PUBLIC_AMAZON_LOCATION_API_KEY` in `.env.local` — key must allow **Maps** tile access, not only Places.
2. **Sandbox Geo:** Run `npm run sandbox` and sign in; uses Cognito-backed `GoodNeighborMap` from `amplify_outputs.json`.

`npm run setup` syncs `NEXT_PUBLIC_API_URL` from `amplify_outputs.json`. Allow browser location or enter a ZIP to center the map. See [amplify/README.md](amplify/README.md).

| Route | Description |
|-------|-------------|
| `/` | Landing page with logo |
| `/login` | Sign in with Google or email (Cognito) |
| `/map` | Map + create/list requests + Gratitude Board (**request API currently flaky**) |
| `/requests/[id]/thread` | Private chat after accepting a helper |

```bash
npm run build   # production build
npm run lint    # ESLint
```

## Environment variables

Copy `.env.example` to `.env.local` when needed. Set `NEXT_PUBLIC_API_URL` after Phase 1 deploy. Secrets (Google OAuth, etc.) are stored in Amplify via `npx ampx sandbox secret set` — not in git.

## Repository layout

```
app/                         # Next.js pages (landing, login, map, thread)
components/
  NeighborhoodMap.tsx        # Amazon Location map + request pins
  CreateRequestForm.tsx      # POST /requests
  RequestListPanel.tsx       # List, respond, accept, fulfill
  RequestThreadView.tsx      # Private thread UI
  MapPageView.tsx            # Map page orchestration
  LeaderboardPanel.tsx
amplify/
  backend.ts                 # DynamoDB + HTTP API + Location map
  functions/api/             # Lambda (profiles, requests-handlers, …)
lib/
  api/client.ts              # Deployed API client
  geofence.ts                # Geofence key for queries
  map/                       # Amazon map helpers, pins
docs/PLAN.md                 # Architecture + current status
```

## Git workflow

When pushing changes to `main` (including agent-assisted commits):

1. `git fetch origin`
2. `git pull --rebase origin main` — integrate remote commits before pushing
3. Resolve any merge conflicts, then `git rebase --continue`
4. `git push origin main`

Avoid force-pushing `main` unless explicitly agreed by the team.

## Team next steps

1. Read [docs/PLAN.md — Current status](docs/PLAN.md#current-status-may-2026).
2. **Fix request API in dev:** sandbox running → `npm run setup` → restart dev → sign out/in → debug `GET/POST /requests` in browser Network tab.
3. Verify create → pins on map → respond → accept → thread → fulfill → Gratitude Board update.
4. Set Google OAuth secrets if needed: `npx ampx sandbox secret set GOOGLE_CLIENT_ID` (and client secret).
5. Connect repo to **Amplify Hosting** for a shared demo URL.

## License

Hackathon project — see team for license terms.
