"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  acceptResponse,
  fulfillRequest,
  getProfileMe,
  listRequestResponses,
  listRequests,
  respondToRequest,
} from "@/lib/api/client";
import { getIdToken } from "@/lib/auth/session";
import type { HelpRequestResponse, PublicHelpRequest } from "@/lib/types/domain";

type RequestListPanelProps = {
  geofence: string;
  refreshKey: number;
  onRefresh: () => void;
};

export function RequestListPanel({
  geofence,
  refreshKey,
  onRefresh,
}: RequestListPanelProps) {
  const [requests, setRequests] = useState<PublicHelpRequest[]>([]);
  const [mySub, setMySub] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [responses, setResponses] = useState<HelpRequestResponse[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!geofence || geofence === "unknown") {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const profile = await getProfileMe(token);
      setMySub(profile.sub);
      const data = await listRequests(token, { geofence });
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load requests");
    } finally {
      setLoading(false);
    }
  }, [geofence]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const loadResponses = async (requestId: string) => {
    try {
      const token = await getIdToken();
      const data = await listRequestResponses(token, requestId);
      setResponses(data);
    } catch {
      setResponses([]);
    }
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    await loadResponses(id);
  };

  const handleRespond = async (requestId: string) => {
    setBusyId(requestId);
    setActionError(null);
    try {
      const token = await getIdToken();
      await respondToRequest(token, requestId, "Happy to help!");
      onRefresh();
      await loadResponses(requestId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not respond");
    } finally {
      setBusyId(null);
    }
  };

  const handleAccept = async (requestId: string, responseId: string) => {
    setBusyId(requestId);
    setActionError(null);
    try {
      const token = await getIdToken();
      await acceptResponse(token, requestId, responseId);
      onRefresh();
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not accept");
    } finally {
      setBusyId(null);
    }
  };

  const handleFulfill = async (requestId: string) => {
    setBusyId(requestId);
    setActionError(null);
    try {
      const token = await getIdToken();
      await fulfillRequest(token, requestId, { hoursContributed: 1 });
      onRefresh();
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not fulfill");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <p className="mt-4 text-sm text-slate-500">Loading requests…</p>;
  }

  if (error) {
    return (
      <p className="mt-4 text-sm text-red-600">
        {error}
        <button
          type="button"
          onClick={() => void load()}
          className="ml-2 font-medium text-teal-700 underline"
        >
          Retry
        </button>
      </p>
    );
  }

  if (requests.length === 0) {
    return (
      <p className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No requests in your area yet. Post one to get started.
      </p>
    );
  }

  return (
    <ul className="mt-4 space-y-3 overflow-y-auto">
      {actionError && (
        <li className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {actionError}
        </li>
      )}
      {requests.map((req) => {
        const isExpanded = expandedId === req.id;
        const statusLabel =
          req.status === "open"
            ? "Open"
            : req.status === "claimed"
              ? "Matched"
              : "Fulfilled";

        return (
          <li
            key={req.id}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">{req.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {req.authorDisplayName} · {statusLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void toggleExpand(req.id)}
                className="shrink-0 text-xs font-medium text-teal-700 hover:underline"
              >
                {isExpanded ? "Hide" : "Details"}
              </button>
            </div>

            {isExpanded && (
              <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                <p>{req.description}</p>
                {req.meetingPlaceLabel && (
                  <p className="mt-2 text-xs text-slate-500">
                    Meet: {req.meetingPlaceLabel}
                  </p>
                )}

                {req.status === "open" && mySub && !req.isOwn && (
                  <button
                    type="button"
                    disabled={busyId === req.id}
                    onClick={() => void handleRespond(req.id)}
                    className="mt-3 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-60"
                  >
                    Offer to help
                  </button>
                )}

                {req.status === "open" && req.isOwn && responses.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Choose a helper below to start a private thread.
                  </p>
                )}

                {req.status === "claimed" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/requests/${req.id}/thread`}
                      className="rounded-lg border border-teal-600 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50"
                    >
                      Open private chat
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={() => void handleFulfill(req.id)}
                      className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-60"
                    >
                      Mark fulfilled
                    </button>
                  </div>
                )}

                {responses.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    <p className="text-xs font-medium uppercase text-slate-500">
                      Offers
                    </p>
                    {responses.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between rounded bg-slate-50 px-2 py-1.5 text-xs"
                      >
                        <span>
                          {r.responderDisplayName} · {r.status}
                        </span>
                        {req.status === "open" &&
                          req.isOwn &&
                          r.status === "pending" && (
                          <button
                            type="button"
                            disabled={busyId === req.id}
                            onClick={() =>
                              void handleAccept(req.id, r.responderSub)
                            }
                            className="font-medium text-teal-700 hover:underline disabled:opacity-60"
                          >
                            Accept
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
