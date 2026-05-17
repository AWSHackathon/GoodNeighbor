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
  createdAt: string;
  updatedAt?: string;
}

export interface ProfileRecord extends UserProfile {
  PK: string;
  SK: string;
}
