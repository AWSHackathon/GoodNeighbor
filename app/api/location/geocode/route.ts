import { NextResponse } from "next/server";
import { geocodePostalCode, getLocationApiKey } from "@/lib/location/aws";

export async function GET(request: Request) {
  const zip = new URL(request.url).searchParams.get("zip");
  if (!zip?.trim()) {
    return NextResponse.json({ error: "zip query param is required" }, { status: 400 });
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
    const result = await geocodePostalCode(zip);
    if (!result) {
      return NextResponse.json({ error: "No results for that ZIP" }, { status: 404 });
    }
    return NextResponse.json({
      lat: result.lat,
      lng: result.lng,
      source: "zip" as const,
      neighborhood: result.label,
      zipCode: zip.trim(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Geocode failed";
    const hint =
      message.includes("403") || message.includes("401")
        ? " Ensure your API key is linked to a Places resource with the Geocode action in the Location Service console."
        : "";
    return NextResponse.json({ error: message + hint }, { status: 502 });
  }
}
