import { NextResponse } from "next/server";
import { getLocationApiKey, isOnLand } from "@/lib/location/aws";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");

  const lat = latRaw ? Number.parseFloat(latRaw) : Number.NaN;
  const lng = lngRaw ? Number.parseFloat(lngRaw) : Number.NaN;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "lat and lng query params are required" },
      { status: 400 },
    );
  }

  if (!getLocationApiKey()) {
    return NextResponse.json(
      {
        error:
          "Amazon Location is not configured. Set AMAZON_LOCATION_API_KEY or run npx ampx sandbox.",
      },
      { status: 503 },
    );
  }

  try {
    const onLand = await isOnLand(lat, lng);
    return NextResponse.json({ onLand });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reverse geocode failed";
    const hint =
      message.includes("403") || message.includes("401")
        ? " Ensure your API key is linked to a Places resource with the ReverseGeocode action."
        : "";
    return NextResponse.json({ error: message + hint }, { status: 502 });
  }
}
