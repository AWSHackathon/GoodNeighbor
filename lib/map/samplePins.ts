import { derivePublicPin } from "@/lib/location/obfuscate";
import type { Coordinates } from "@/lib/types/domain";

export type MapPin = {
  coordinates: [number, number];
  title: string;
  address?: string;
  /** Obfuscation buffer for request pins (AWS-US-3). */
  bufferRadiusMeters?: number;
};

/** Demo obfuscated pins near the map center (Phase 4 will use GET /requests). */
export function buildSamplePins(center: Coordinates): MapPin[] {
  const samples = [
    {
      id: "sample-groceries",
      title: "Need groceries pickup",
      address: "Approximate area pin (~40–80m buffer)",
      offset: { lat: 0.004, lng: 0.006 },
    },
    {
      id: "sample-yard",
      title: "Yard work",
      address: "Meet near community garden (public hint)",
      offset: { lat: -0.005, lng: 0.003 },
    },
  ];

  return samples.map((sample) => {
    const trueLat = center.lat + sample.offset.lat;
    const trueLng = center.lng + sample.offset.lng;
    const pin = derivePublicPin(trueLat, trueLng, sample.id);
    return {
      coordinates: [pin.lng, pin.lat] as [number, number],
      title: sample.title,
      address: sample.address,
    };
  });
}
