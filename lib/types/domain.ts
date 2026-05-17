/**
 * Domain types for Good Neighbor (see docs/PLAN.md).
 * Public types omit true coordinates; private fields are server-only.
 */

export type HelpRequestStatus = "open" | "claimed" | "fulfilled" | "expired";
export type ResponseStatus = "pending" | "accepted" | "declined";

export interface Coordinates {
  lat: number;
  lng: number;
}

/** Returned by GET /requests — safe to show neighbors. */
export interface PublicHelpRequest {
  id: string;
  title: string;
  description: string;
  authorDisplayName: string;
  publicLat: number;
  publicLng: number;
  bufferRadiusMeters: number;
  meetingPlaceLabel?: string;
  neighborhood: string;
  status: HelpRequestStatus;
  createdAt: string;
  /** Present on list when the viewer is the requester. */
  isOwn?: boolean;
}

/** POST /requests body — true location never stored on the client after submit. */
export interface CreateHelpRequestInput {
  title: string;
  description: string;
  trueLat: number;
  trueLng: number;
  meetingPlaceLabel?: string;
}

export interface FulfillHelpRequestInput {
  hoursContributed?: number;
}

export interface HelpRequestResponse {
  id: string;
  requestId: string;
  responderSub: string;
  responderDisplayName: string;
  status: ResponseStatus;
  message?: string;
  createdAt: string;
}

export interface ThreadMessage {
  id: string;
  requestId: string;
  senderSub: string;
  body: string;
  createdAt: string;
}

export interface PrivateThread {
  requestId: string;
  requesterSub: string;
  helperSub: string;
  messages: ThreadMessage[];
}

export type UserRole = "resident" | "moderator" | "admin";

/** Profile fields safe to expose to other users. */
export interface PublicProfile {
  displayName: string;
  neighborhood?: string;
  zipCode?: string;
}

/** Owner-only profile (map center not published as a pin). */
export interface UserProfile extends PublicProfile {
  sub: string;
  email: string;
  role: UserRole;
  /** Private — used for map center and geofence queries only. */
  lat?: number;
  lng?: number;
  createdAt: string;
  updatedAt?: string;
}
