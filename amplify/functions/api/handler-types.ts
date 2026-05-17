export type UserRole = "resident" | "moderator" | "admin";

export interface UserProfile {
  sub: string;
  email: string;
  displayName: string;
  role: UserRole;
  neighborhood?: string;
  zipCode?: string;
  lat?: number;
  lng?: number;
  locationSource?: "gps" | "zip" | "ip";
  createdAt: string;
  updatedAt?: string;
}

export interface ProfileRecord extends UserProfile {
  PK: string;
  SK: string;
}

export interface UserUsageMetrics {
  requestsPosted: number;
  responsesSubmitted: number;
  helpsCompleted: number;
  hoursContributed: number;
  lastActiveAt?: string;
}

export interface StatsRecord {
  PK: string;
  SK: string;
  requestsPosted: number;
  responsesSubmitted: number;
  helpsCompleted: number;
  hoursContributed: number;
  lastActiveAt?: string;
  updatedAt: string;
}

export interface NeighborhoodContribution {
  neighborhood: string;
  allTime: { requestsCompleted: number; hoursContributed: number };
  thisWeek: {
    requestsCompleted: number;
    hoursContributed: number;
    weekId: string;
  };
}

export interface UserProfileWithMetrics extends UserProfile {
  usageMetrics: UserUsageMetrics;
  neighborhoodContribution?: NeighborhoodContribution;
}
