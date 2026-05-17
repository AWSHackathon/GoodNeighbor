# Amplify Gen 2 backend

## Resources

| Resource | Purpose |
|----------|---------|
| `auth/resource.ts` | Cognito User Pool + Identity Pool (guest + signed-in) |
| `backend.ts` | **GoodNeighborMap** on Amazon Location Service (`VectorEsriNavigation`) |

Guest and authenticated IAM roles can call `geo:GetMap*` on the map.

## Deploy (personal sandbox)

From the repo root (AWS credentials required):

```bash
npm run sandbox
```

This writes `amplify_outputs.json` for the Next.js app. The map on `/map` uses Amplify Geo + `maplibre-gl-js-amplify`.

## API key alternative (no sandbox)

1. In [Amazon Location Service](https://console.aws.amazon.com/location/home), create a **map** (e.g. style **Standard** for API keys).
2. Create a **place index** (Places) if you want ZIP geocode on `/map`.
3. Create an **API key** with:
   - **Maps** resource `arn:aws:geo-maps:<region>::provider/default` and actions **`geo-maps:*`** (or at least tile + style actions). A key scoped only to **Places / Geocode** loads the style descriptor but returns **403** on tiles.
   - Optional: **Places** resource with **Geocode** for ZIP lookup on `/map`.
4. Add to `.env.local`:

```bash
NEXT_PUBLIC_AMAZON_LOCATION_API_KEY=your-key
NEXT_PUBLIC_AWS_REGION=us-west-2
NEXT_PUBLIC_LOCATION_MAP_STYLE=Standard
AMAZON_LOCATION_API_KEY=your-key
```

Restart `npm run dev` and open `/map`.
