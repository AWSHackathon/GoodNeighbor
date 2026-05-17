# Good Neighbor

**AWSHackathon2026-GoodNeighbor** — AWS Hackathon 2026 neighborhood assistance map. Sign in with Google, see nearby help requests on a map centered on your location, respond to neighbors, and coordinate meet-ups privately after you accept an offer.

## Location

The map centers on the user’s area—no fixed demo neighborhood. Resolution order: **device GPS** (browser permission) → **IP geolocation** → **manual ZIP** if GPS is denied or IP is wrong. Details are in [docs/PLAN.md](docs/PLAN.md#location-resolution).

**Leaderboard:** The bottom half of `/map` ranks neighbors by **requests completed** and **hours contributed**, scoped to your neighborhood. Use the dropdown to switch **All time** vs **This week**; data refreshes when your neighborhood changes. See [docs/PLAN.md — Leaderboard](docs/PLAN.md#leaderboard).

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

**Phase 1 (current):** Amplify Gen 2 backend — Cognito (Google + email), DynamoDB profiles, HTTP API (`GET/PUT /profiles/me`), login UI, route protection. Run `npm run sandbox` to deploy.

**Next (Phase 3+):** Help requests CRUD, responses, thread, real leaderboard API.

See [docs/PLAN.md](docs/PLAN.md) for the full architecture and implementation phases.

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

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). After sandbox deploy, sign in at `/login`. Without Cognito deployed, **Preview map** on `/login` still works.

Mock API (leaderboard): `GET http://127.0.0.1:3000/api/leaderboard?neighborhood=capitol-hill&period=all`

### Amazon Location map

The `/map` screen uses **MapLibre GL** with **Amazon Location Service** tiles.

1. **API key (quickest):** Create a map + API key in the [Location Service console](https://console.aws.amazon.com/location/home), then set `NEXT_PUBLIC_AMAZON_LOCATION_API_KEY` in `.env.local` (see `.env.example`).
2. **Amplify sandbox:** `npm run sandbox` deploys Cognito + `GoodNeighborMap` and generates `amplify_outputs.json`.

Allow browser location or enter a ZIP to center the map. See [amplify/README.md](amplify/README.md).

| Route | Description |
|-------|-------------|
| `/` | Landing page with logo |
| `/login` | Sign in with Google or email (Cognito — Phase 1) |
| `/map` | Top: map + requests; bottom: neighborhood leaderboard with all-time / weekly toggle (Phase 4–6) |
| `/requests/[id]/thread` | Private chat after accepting a helper (Phase 5) |

```bash
npm run build   # production build
npm run lint    # ESLint
```

## Environment variables

Copy `.env.example` to `.env.local` when needed. Set `NEXT_PUBLIC_API_URL` after Phase 1 deploy. Secrets (Google OAuth, etc.) are stored in Amplify via `npx ampx sandbox secret set` — not in git.

## Repository layout

```
app/                    # Next.js pages (landing, login, map, thread stub)
components/             # React components (Phase 1+)
lib/
  api/client.ts       # API client stubs (requests, thread, accept)
  api/leaderboard.ts  # Leaderboard by neighborhood + period
  leaderboard/        # Mock leaderboard data for UI stub
  location/           # GPS/IP/ZIP resolve + public pin obfuscation
  types/domain.ts     # Public vs private domain types
  types/leaderboard.ts
components/
  LeaderboardPanel.tsx  # Bottom-half table; all-time vs this week
amplify/functions/api/  # Lambda route stubs (Phase 1+)
docs/                 # Architecture plan
public/               # Static assets (logo)
```

## Git workflow

When pushing changes to `main` (including agent-assisted commits):

1. `git fetch origin`
2. `git pull --rebase origin main` — integrate remote commits before pushing
3. Resolve any merge conflicts, then `git rebase --continue`
4. `git push origin main`

Avoid force-pushing `main` unless explicitly agreed by the team.

## Team next steps

1. Read [docs/PLAN.md](docs/PLAN.md) and [amplify/README.md](amplify/README.md).
2. Set Google OAuth secrets and run `npm run sandbox`.
3. Sign in at `/login` and verify profile via API.
4. Phase 3: implement `POST/GET /requests` in `amplify/functions/api/handler.ts`.
5. Connect repo to **Amplify Hosting** in the AWS Console.

## License

Hackathon project — see team for license terms.
