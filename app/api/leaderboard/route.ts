import { NextResponse } from "next/server";
import { getMockLeaderboard } from "@/lib/leaderboard/mockData";
import type { LeaderboardPeriod } from "@/lib/types/leaderboard";

/** Local mock for GET /leaderboard (Phase 6 Lambda). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const neighborhood = searchParams.get("neighborhood");
  const period = (searchParams.get("period") ?? "all") as LeaderboardPeriod;

  if (!neighborhood) {
    return NextResponse.json(
      { error: "neighborhood query param is required" },
      { status: 400 },
    );
  }

  if (period !== "all" && period !== "week") {
    return NextResponse.json(
      { error: "period must be all or week" },
      { status: 400 },
    );
  }

  return NextResponse.json(getMockLeaderboard(neighborhood, period));
}
