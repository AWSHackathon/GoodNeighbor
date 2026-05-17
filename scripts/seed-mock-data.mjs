/**
 * AWS-US-4 — Seed 10 mock users (A–J) and 1–5 requests each into DynamoDB.
 * Run: npm run seed:mock  (requires sandbox + AWS credentials)
 */

import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const requireFromAmplify = createRequire(
  join(root, "amplify", "package.json"),
);

const { DynamoDBClient } = requireFromAmplify("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
} = requireFromAmplify("@aws-sdk/lib-dynamodb");

const BUFFER_RADIUS_METERS_MIN = 40;
const BUFFER_RADIUS_METERS_MAX = 80;
const METERS_PER_DEGREE_LAT = 111_320;

/** Shared list index — all mock requests stay queryable via client demo keys. */
const DEMO_LIST_GEOFENCE = "98102";
const GEOFENCE_SLUG = "capitol-hill";
const DEMO_LOC_BUCKET = geofenceLocBucket(47.6253, -122.3222);

/** Seattle neighborhoods — spread pins across the city (~5–10 km apart). */
const SEATTLE_LOCATIONS = [
  { neighborhood: "Capitol Hill", lat: 47.6253, lng: -122.3222, zip: "98102" },
  { neighborhood: "Ballard", lat: 47.6687, lng: -122.3846, zip: "98107" },
  { neighborhood: "West Seattle", lat: 47.5615, lng: -122.3869, zip: "98116" },
  { neighborhood: "Fremont", lat: 47.6516, lng: -122.3502, zip: "98103" },
  { neighborhood: "Queen Anne", lat: 47.6372, lng: -122.3571, zip: "98109" },
  { neighborhood: "University District", lat: 47.66, lng: -122.314, zip: "98105" },
  { neighborhood: "Beacon Hill", lat: 47.5651, lng: -122.3108, zip: "98108" },
  { neighborhood: "Green Lake", lat: 47.6802, lng: -122.329, zip: "98103" },
  { neighborhood: "Columbia City", lat: 47.559, lng: -122.2905, zip: "98118" },
  { neighborhood: "Wallingford", lat: 47.6615, lng: -122.3352, zip: "98103" },
  { neighborhood: "International District", lat: 47.5986, lng: -122.3269, zip: "98104" },
  { neighborhood: "Magnolia", lat: 47.6398, lng: -122.3998, zip: "98199" },
];

function locationForRequest(userIndex, requestIndex) {
  const spot =
    SEATTLE_LOCATIONS[(userIndex * 5 + requestIndex * 3) % SEATTLE_LOCATIONS.length];
  const jitter = {
    lat: ((requestIndex % 3) - 1) * 0.0018 + (userIndex % 4) * 0.0004,
    lng: ((requestIndex % 2) * 2 - 1) * 0.0022 - (userIndex % 3) * 0.0005,
  };
  return {
    neighborhood: spot.neighborhood,
    lat: spot.lat + jitter.lat,
    lng: spot.lng + jitter.lng,
  };
}

function homeLocationForUser(userIndex) {
  return SEATTLE_LOCATIONS[userIndex % SEATTLE_LOCATIONS.length];
}

function hashRequestId(requestId) {
  let hash = 5381;
  for (let i = 0; i < requestId.length; i++) {
    hash = (hash * 33) ^ requestId.charCodeAt(i);
  }
  return hash >>> 0;
}

function seededUnit(hash, salt) {
  const x = Math.sin((hash + salt) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function derivePublicPin(trueLat, trueLng, requestId) {
  const hash = hashRequestId(requestId);
  const angle = seededUnit(hash, 1) * 2 * Math.PI;
  const t = seededUnit(hash, 2);
  const distanceMeters =
    BUFFER_RADIUS_METERS_MIN +
    t * (BUFFER_RADIUS_METERS_MAX - BUFFER_RADIUS_METERS_MIN);
  const latOffset = (distanceMeters * Math.cos(angle)) / METERS_PER_DEGREE_LAT;
  const lngScale =
    METERS_PER_DEGREE_LAT * Math.cos((trueLat * Math.PI) / 180);
  const lngOffset = (distanceMeters * Math.sin(angle)) / lngScale;
  return {
    lat: trueLat + latOffset,
    lng: trueLng + lngOffset,
    bufferRadiusMeters: distanceMeters,
  };
}

function geofenceLocBucket(lat, lng) {
  return `loc-${Math.round(lat * 100)}-${Math.round(lng * 100)}`;
}

function gsiSk(status, createdAt, id) {
  return `STATUS#${status}#${createdAt}#${id}`;
}

function currentIsoWeekId(date = new Date()) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function loadTableName() {
  const outputsPath = join(root, "amplify_outputs.json");
  if (!existsSync(outputsPath)) {
    throw new Error(
      "amplify_outputs.json not found. Run npm run sandbox first.",
    );
  }
  const outputs = JSON.parse(readFileSync(outputsPath, "utf8"));
  const tableName = outputs?.custom?.data?.tableName;
  if (!tableName) {
    throw new Error("custom.data.tableName missing from amplify_outputs.json");
  }
  return tableName;
}

/** Request count 1–5 per user (deterministic). */
function requestCountForUser(index) {
  return (index * 7 + 3) % 5 + 1;
}

const MOCK_USERS = [
  {
    sub: "mock-demo-alex",
    displayName: "Alex Martinez",
    email: "alex.martinez@goodneighbor-demo.mock",
  },
  {
    sub: "mock-demo-bob",
    displayName: "Bob Nguyen",
    email: "bob.nguyen@goodneighbor-demo.mock",
  },
  {
    sub: "mock-demo-charlie",
    displayName: "Charlie Okonkwo",
    email: "charlie.okonkwo@goodneighbor-demo.mock",
  },
  {
    sub: "mock-demo-dana",
    displayName: "Dana Patel",
    email: "dana.patel@goodneighbor-demo.mock",
  },
  {
    sub: "mock-demo-ethan",
    displayName: "Ethan Kim",
    email: "ethan.kim@goodneighbor-demo.mock",
  },
  {
    sub: "mock-demo-fiona",
    displayName: "Fiona Lewis",
    email: "fiona.lewis@goodneighbor-demo.mock",
  },
  {
    sub: "mock-demo-george",
    displayName: "George Walker",
    email: "george.walker@goodneighbor-demo.mock",
  },
  {
    sub: "mock-demo-hannah",
    displayName: "Hannah Brooks",
    email: "hannah.brooks@goodneighbor-demo.mock",
  },
  {
    sub: "mock-demo-ivan",
    displayName: "Ivan Chen",
    email: "ivan.chen@goodneighbor-demo.mock",
  },
  {
    sub: "mock-demo-julia",
    displayName: "Julia Santos",
    email: "julia.santos@goodneighbor-demo.mock",
  },
];

const REQUEST_TEMPLATES = [
  {
    title: "Grocery pickup this afternoon",
    description:
      "Need a few bags from the co-op on Broadway — milk, bread, and fruit. I can Venmo same day. Happy to meet at the corner market entrance.",
    meetingPlaceLabel: "Near co-op main entrance on Broadway",
  },
  {
    title: "Help moving two book boxes",
    description:
      "Moving a short bookshelf upstairs. Two medium boxes (~25 lb each). Should take 20–30 minutes with a dolly if you have one.",
    meetingPlaceLabel: "Alley parking off 15th Ave E",
  },
  {
    title: "Borrow a tall ladder for gutter check",
    description:
      "Looking to borrow an extension ladder for about 2 hours to clear leaves. Will return cleaned and before 5pm.",
    meetingPlaceLabel: "Front sidewalk, house with blue planter",
  },
  {
    title: "Dog walk while I'm at an appointment",
    description:
      "Friendly lab mix, 45 min loop around the park. Leash and treats provided. He pulls a little at squirrels.",
    meetingPlaceLabel: "Meet at Volunteer Park north gate",
  },
  {
    title: "Ride to minor clinic visit",
    description:
      "Need a lift to Swedish Cherry Hill and back (~90 min total). No medical assistance needed, just driving.",
    meetingPlaceLabel: "Pickup on Thomas St near 12th",
  },
  {
    title: "Fix a slow kitchen faucet drip",
    description:
      "Hot side drip — likely washer. I have parts and tools in the garage. Handy neighbor appreciated.",
    meetingPlaceLabel: "Driveway side gate",
  },
  {
    title: "Shovel front steps after snow",
    description:
      "Elderly neighbor needs front steps and walkway cleared. Salt provided. About 30–45 minutes of work.",
    meetingPlaceLabel: "Tan house with cedar planters",
  },
  {
    title: "Donation pickup — kids books & toys",
    description:
      "Two bags of gently used children's books and puzzles for donation drop-off. Can help load your car.",
    meetingPlaceLabel: "Curbside on Roy St",
  },
  {
    title: "Watch kids for one hour (ages 6 & 8)",
    description:
      "Kids will play in the living room; snacks ready. Parents working from home upstairs. CPR-certified preferred.",
    meetingPlaceLabel: "Apartment lobby on Harvard Ave",
  },
  {
    title: "Bring in patio furniture before rain",
    description:
      "Four chairs and a small table from the back patio into the garage. Forecast shows rain tonight.",
    meetingPlaceLabel: "Back gate off alley",
  },
];

function stableRequestId(userSub, requestIndex) {
  const slug = userSub.replace("mock-demo-", "");
  return `mock-req-${slug}-${requestIndex}`;
}

function daysAgoIso(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

async function putItem(doc, tableName, item) {
  await doc.send(new PutCommand({ TableName: tableName, Item: item }));
}

const LEADERBOARD_SEED_COUNT = 100;
const LEADERBOARD_FIRST_NAMES = [
  "Alex",
  "Bob",
  "Casey",
  "Dana",
  "Ellis",
  "Finn",
  "Gray",
  "Harper",
  "Ivy",
  "Jordan",
  "Kai",
  "Logan",
  "Morgan",
  "Noah",
  "Parker",
  "Quinn",
  "Riley",
  "Sam",
  "Taylor",
  "Uma",
];

/** Geofence PKs for leaderboard seed (must match lib/geofence.ts aliases). */
const LEADERBOARD_GEOFENCE_KEYS = [
  GEOFENCE_SLUG,
  DEMO_LIST_GEOFENCE,
  DEMO_LOC_BUCKET,
];

/** AWS-US-5 — 100 ranked contributors for paginated leaderboard demo. */
async function seedPaginatedLeaderboard(doc, tableName, weekId, now) {
  let count = 0;
  for (let i = 0; i < LEADERBOARD_SEED_COUNT; i++) {
    const sub = `mock-leader-${String(i + 1).padStart(3, "0")}`;
    const rankIndex = LEADERBOARD_SEED_COUNT - i;
    const allHours = Math.round((5 + rankIndex * 0.45) * 10) / 10;
    const allRequests = Math.max(1, Math.floor(rankIndex / 4));
    const weekHours = Math.round(allHours * 0.22 * 10) / 10;
    const weekRequests = Math.max(1, Math.round(allRequests * 0.22));
    const first = LEADERBOARD_FIRST_NAMES[i % LEADERBOARD_FIRST_NAMES.length];
    const displayName = `${first} ${String.fromCharCode(65 + (i % 26))}.`;

    for (const [sk, requestsCompleted, hoursContributed] of [
      [`LEADER#ALL#${sub}`, allRequests, allHours],
      [`LEADER#WEEK#${weekId}#${sub}`, weekRequests, weekHours],
    ]) {
      for (const geofenceKey of LEADERBOARD_GEOFENCE_KEYS) {
        await putItem(doc, tableName, {
          PK: `GEOFENCE#${geofenceKey}`,
          SK: sk,
          userSub: sub,
          displayName,
          requestsCompleted,
          hoursContributed,
          updatedAt: now,
          seedBatch: "AWS-US-5",
        });
        count++;
      }
    }
  }
  return count;
}

async function seed() {
  const tableName = loadTableName();
  const region =
    JSON.parse(readFileSync(join(root, "amplify_outputs.json"), "utf8"))
      ?.auth?.aws_region ?? "us-east-1";

  const client = new DynamoDBClient({ region });
  const doc = DynamoDBDocumentClient.from(client);
  const weekId = currentIsoWeekId();
  const now = new Date().toISOString();

  let profileCount = 0;
  let statsCount = 0;
  let requestCount = 0;
  let leaderCount = 0;

  for (let ui = 0; ui < MOCK_USERS.length; ui++) {
    const user = MOCK_USERS[ui];
    const home = homeLocationForUser(ui);
    const profileCreated = daysAgoIso(30 + ui * 2);

    await putItem(doc, tableName, {
      PK: `USER#${user.sub}`,
      SK: "PROFILE",
      sub: user.sub,
      email: user.email,
      displayName: user.displayName,
      role: "resident",
      neighborhood: home.neighborhood,
      zipCode: home.zip,
      lat: home.lat,
      lng: home.lng,
      createdAt: profileCreated,
      updatedAt: now,
      seedBatch: "AWS-US-4",
    });
    profileCount++;

    const numRequests = requestCountForUser(ui);
    const helpsCompleted = ui % 4;
    const hoursContributed = helpsCompleted * (1.5 + (ui % 3) * 0.5);

    await putItem(doc, tableName, {
      PK: `USER#${user.sub}`,
      SK: "STATS",
      requestsPosted: numRequests,
      responsesSubmitted: Math.max(0, ui - 2),
      helpsCompleted,
      hoursContributed,
      lastActiveAt: daysAgoIso(ui % 5),
      updatedAt: now,
      seedBatch: "AWS-US-4",
    });
    statsCount++;

    if (helpsCompleted > 0) {
      for (const sk of [
        `LEADER#ALL#${user.sub}`,
        `LEADER#WEEK#${weekId}#${user.sub}`,
      ]) {
        await putItem(doc, tableName, {
          PK: `GEOFENCE#${GEOFENCE_SLUG}`,
          SK: sk,
          userSub: user.sub,
          displayName: user.displayName,
          requestsCompleted: helpsCompleted,
          hoursContributed:
            sk.includes("WEEK") ? Math.min(helpsCompleted, 2) : helpsCompleted,
          updatedAt: now,
          seedBatch: "AWS-US-4",
        });
        leaderCount++;
      }
    }

    for (let ri = 0; ri < numRequests; ri++) {
      const template =
        REQUEST_TEMPLATES[(ui * 3 + ri) % REQUEST_TEMPLATES.length];
      const id = stableRequestId(user.sub, ri + 1);
      const spot = locationForRequest(ui, ri);
      const trueLat = spot.lat;
      const trueLng = spot.lng;
      const geofence = DEMO_LIST_GEOFENCE;
      const createdAt = daysAgoIso(14 - ri - ui);
      const pin = derivePublicPin(trueLat, trueLng, id);

      let status = "open";
      let acceptedHelperSub;
      let fulfilledAt;
      if (ui === 1 && ri === 0) {
        status = "claimed";
        acceptedHelperSub = MOCK_USERS[0].sub;
      } else if (ui === 3 && ri === 0) {
        status = "fulfilled";
        acceptedHelperSub = MOCK_USERS[4].sub;
        fulfilledAt = daysAgoIso(2);
      } else if (ui === 5 && ri === 1) {
        status = "fulfilled";
        acceptedHelperSub = MOCK_USERS[2].sub;
        fulfilledAt = daysAgoIso(4);
      }

      await putItem(doc, tableName, {
        PK: `REQUEST#${id}`,
        SK: "METADATA",
        GSI1PK: `GEOFENCE#${DEMO_LIST_GEOFENCE}`,
        GSI1SK: gsiSk(status, createdAt, id),
        id,
        title: template.title,
        description: template.description,
        requesterSub: user.sub,
        authorDisplayName: user.displayName,
        trueLat,
        trueLng,
        publicLat: pin.lat,
        publicLng: pin.lng,
        bufferRadiusMeters: pin.bufferRadiusMeters,
        meetingPlaceLabel: `${template.meetingPlaceLabel} (${spot.neighborhood})`,
        neighborhood: spot.neighborhood,
        geofence,
        status,
        acceptedHelperSub,
        createdAt,
        updatedAt: fulfilledAt ?? createdAt,
        fulfilledAt,
        seedBatch: "AWS-US-4",
      });
      requestCount++;

      if (status === "claimed" && acceptedHelperSub) {
        const responseId = `seed-resp-${id}`;
        await putItem(doc, tableName, {
          PK: `REQUEST#${id}`,
          SK: `RESPONSE#${acceptedHelperSub}`,
          id: responseId,
          requestId: id,
          responderSub: acceptedHelperSub,
          responderDisplayName: MOCK_USERS[0].displayName,
          status: "accepted",
          message:
            "I can help this afternoon — free after 3pm and have a hand truck.",
          createdAt: daysAgoIso(3),
          seedBatch: "AWS-US-4",
        });
        await putItem(doc, tableName, {
          PK: `REQUEST#${id}`,
          SK: `THREAD#${acceptedHelperSub}`,
          requestId: id,
          requesterSub: user.sub,
          helperSub: acceptedHelperSub,
          createdAt: daysAgoIso(3),
          seedBatch: "AWS-US-4",
        });
        const msgTs = "2026-05-10T18:00:00.000Z";
        const msgId = `seed-msg-${id}-1`;
        await putItem(doc, tableName, {
          PK: `REQUEST#${id}`,
          SK: `MSG#${msgTs}#${msgId}`,
          id: msgId,
          requestId: id,
          senderSub: user.sub,
          body: "Thanks! Let's meet at the co-op entrance at 3:15pm.",
          createdAt: msgTs,
          seedBatch: "AWS-US-4",
        });
      }
    }
  }

  leaderCount += await seedPaginatedLeaderboard(doc, tableName, weekId, now);

  console.log(`AWS-US-4 seed complete → table "${tableName}" (${region})`);
  console.log(`  Profiles:  ${profileCount}`);
  console.log(`  Stats:     ${statsCount}`);
  console.log(`  Requests:  ${requestCount} (spread across ${SEATTLE_LOCATIONS.length} Seattle areas)`);
  console.log(`  Leaderboard rows: ${leaderCount}`);
  console.log(
    `  List index: GEOFENCE#${DEMO_LIST_GEOFENCE} (+ client queries ${GEOFENCE_SLUG}, ${DEMO_LOC_BUCKET})`,
  );
  console.log(
    "  Re-run: upserts same PK/SK (updates in place). Orphan rows only if IDs change.",
  );
}

seed().catch((err) => {
  console.error("Seed failed:", err.message ?? err);
  process.exit(1);
});
