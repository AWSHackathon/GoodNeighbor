"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  acceptResponse,
  fulfillRequest,
  getProfileMe,
  listRequestResponses,
  respondToRequest,
} from "@/lib/api/client";
import { getIdToken } from "@/lib/auth/session";
import {
  formatDistanceMeters,
  NEARBY_REQUEST_RADIUS_METERS,
  REQUEST_LIST_PAGE_SIZE,
  requestDistanceMeters,
  sortRequestsByDistance,
} from "@/lib/location/nearby";
import type { Coordinates, HelpRequestResponse, PublicHelpRequest } from "@/lib/types/domain";

type RequestListPanelProps = {
  requests: PublicHelpRequest[];
  browseCenter?: Coordinates | null;
  loading?: boolean;
  error?: string | null;
  refreshKey: number;
  onRefresh: () => void;
};

export function RequestListPanel({
  requests,
  browseCenter = null,
  loading = false,
  error = null,
  refreshKey,
  onRefresh,
}: RequestListPanelProps) {
  const [mySub, setMySub] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [responses, setResponses] = useState<HelpRequestResponse[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const sortedRequests = useMemo(
    () => sortRequestsByDistance(requests, browseCenter),
    [requests, browseCenter?.lat, browseCenter?.lng],
  );

  const totalPages = Math.max(
    1,
    Math.ceil(sortedRequests.length / REQUEST_LIST_PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages - 1);
  const pageRequests = sortedRequests.slice(
    safePage * REQUEST_LIST_PAGE_SIZE,
    safePage * REQUEST_LIST_PAGE_SIZE + REQUEST_LIST_PAGE_SIZE,
  );

  useEffect(() => {
    setPage(0);
    setExpandedId(null);
  }, [refreshKey, sortedRequests.length, browseCenter?.lat, browseCenter?.lng]);

  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  useEffect(() => {
    void (async () => {
      try {
        const token = await getIdToken();
        const profile = await getProfileMe(token);
        setMySub(profile.sub);
      } catch {
        /* optional for respond UI */
      }
    })();
  }, []);

  useEffect(() => {
    if (!expandedId) return;
    void loadResponses(expandedId);
  }, [expandedId, refreshKey]);

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
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not fulfill");
    } finally {
      setBusyId(null);
    }
  };

  if (loading && requests.length === 0) {
    return <p className="mt-4 text-sm text-slate-500">Loading requests…</p>;
  }

  if (error && requests.length === 0) {
    return (
      <p className="mt-4 text-sm text-red-600">
        {error}
        <button
          type="button"
          onClick={onRefresh}
          className="ml-2 font-medium text-teal-700 underline"
        >
          Retry
        </button>
      </p>
    );
  }

  if (sortedRequests.length === 0) {
    return (
      <p className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
        No requests within ~
        {Math.round(NEARBY_REQUEST_RADIUS_METERS / 1000)} km of your location yet.
        Post one to get started.
      </p>
    );
  }

  const radiusKm = Math.round(NEARBY_REQUEST_RADIUS_METERS / 1000);

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      <p className="shrink-0 text-xs text-slate-500">
        {sortedRequests.length} request{sortedRequests.length === 1 ? "" : "s"}{" "}
        within ~{radiusKm} km
        {browseCenter ? " · nearest first" : ""}
      </p>
      <ul className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto">
      {actionError && (
        <li className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {actionError}
        </li>
      )}
      {pageRequests.map((req) => {
        const distanceLabel =
          browseCenter && !req.isOwn
            ? formatDistanceMeters(requestDistanceMeters(browseCenter, req))
            : null;
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
            <RequestCardBody
              req={req}
              distanceLabel={distanceLabel}
              isExpanded={isExpanded}
              statusLabel={statusLabel}
              mySub={mySub}
              busyId={busyId}
              responses={isExpanded ? responses : []}
              onToggleExpand={() => void toggleExpand(req.id)}
              onRespond={() => void handleRespond(req.id)}
              onAccept={(responseId) => void handleAccept(req.id, responseId)}
              onFulfill={() => void handleFulfill(req.id)}
            />
          </li>
        );
      })}
      </ul>
      {totalPages > 1 && (
        <nav
          className="mt-3 flex shrink-0 items-center justify-between border-t border-slate-200 pt-3"
          aria-label="Requests pagination"
        >
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-slate-600">
            Page {safePage + 1} of {totalPages}
            <span className="text-slate-400">
              {" "}
              · {safePage * REQUEST_LIST_PAGE_SIZE + 1}–
              {Math.min(
                (safePage + 1) * REQUEST_LIST_PAGE_SIZE,
                sortedRequests.length,
              )}{" "}
              of {sortedRequests.length}
            </span>
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}

function RequestCardBody(props: {
  req: PublicHelpRequest;
  distanceLabel: string | null;
  isExpanded: boolean;
  statusLabel: string;
  mySub: string | null;
  busyId: string | null;
  responses: HelpRequestResponse[];
  onToggleExpand: () => void;
  onRespond: () => void;
  onAccept: (responseId: string) => void;
  onFulfill: () => void;
}) {
  const {
    req,
    distanceLabel,
    isExpanded,
    statusLabel,
    mySub,
    busyId,
    responses,
    onToggleExpand,
    onRespond,
    onAccept,
    onFulfill,
  } = props;

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{req.title}</p>
          <p className="mt-1 text-xs text-slate-500">
            {req.authorDisplayName} · {statusLabel}
            {distanceLabel ? ` · ${distanceLabel} away` : null}
            {req.isOwn ? " · Your post" : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleExpand}
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
              onClick={onRespond}
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
                onClick={onFulfill}
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
                      onClick={() => onAccept(r.responderSub)}
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
    </>
  );
}
