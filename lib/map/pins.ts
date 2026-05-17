import type { MapPin } from "@/lib/map/samplePins";
import type { PublicHelpRequest } from "@/lib/types/domain";

export function buildPinsFromRequests(requests: PublicHelpRequest[]): MapPin[] {
  return requests
    .filter((r) => r.status !== "expired")
    .map((r) => ({
      coordinates: [r.publicLng, r.publicLat] as [number, number],
      title: r.title,
      address:
        r.meetingPlaceLabel ??
        `Approximate area (~${Math.round(r.bufferRadiusMeters)}m buffer)`,
    }));
}
