"use client";

import { useState } from "react";
import { createRequest } from "@/lib/api/client";
import { ensureUserProfile } from "@/lib/auth/profile";
import { getIdToken } from "@/lib/auth/session";
import type { Coordinates, PublicHelpRequest } from "@/lib/types/domain";

type CreateRequestFormProps = {
  location: Coordinates | null;
  pickMode: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (created: PublicHelpRequest, postedAt: Coordinates) => void;
};

const SUGGESTED_TITLES = [
  "Need help moving boxes",
  "Volunteer ride to appointment",
  "Grocery pickup",
  "Yard work this weekend",
];

export function CreateRequestForm({
  location,
  pickMode,
  onOpenChange,
  onCreated,
}: CreateRequestFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetingPlaceLabel, setMeetingPlaceLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setFormOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange(next);
    if (!next) setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) return;
    if (!location) {
      setError("Click the map to choose where you need help.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await ensureUserProfile();
      const token = await getIdToken();
      const created = await createRequest(token, {
        title: title.trim(),
        description: description.trim(),
        trueLat: location.lat,
        trueLng: location.lng,
        meetingPlaceLabel: meetingPlaceLabel.trim() || undefined,
      });
      setTitle("");
      setDescription("");
      setMeetingPlaceLabel("");
      setFormOpen(false);
      onCreated({ ...created, isOwn: true }, location);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create request");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setFormOpen(true)}
        className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
      >
        Post a volunteer help request
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-teal-200 bg-teal-50/50 p-4"
    >
      <p className="text-xs text-slate-600">
        Ask neighbors to volunteer for a task.{" "}
        {pickMode
          ? "Click the map (left) to set the orange pin where help is needed."
          : "Allow location or enter a ZIP on the map, then click to place your pin."}
      </p>
      {location && (
        <p className="text-xs font-medium text-amber-800">
          Request pin set — neighbors will see a teal pin in this approximate area
          (~400–800 m), not your exact address.
        </p>
      )}
      <TitleSuggestions onPick={setTitle} />
      <input
        type="text"
        placeholder="Title (what do you need help with?)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        required
      />
      <textarea
        placeholder="Describe the task, timing, and anything volunteers should know"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        required
      />
      <input
        type="text"
        placeholder="Meeting place hint (optional, keep vague — e.g. near Safeway)"
        value={meetingPlaceLabel}
        onChange={(e) => setMeetingPlaceLabel(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !location}
          className="flex-1 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {submitting ? "Posting…" : "Post request"}
        </button>
        <button
          type="button"
          onClick={() => setFormOpen(false)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function TitleSuggestions({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SUGGESTED_TITLES.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onPick(suggestion)}
          className="rounded-full border border-teal-300 bg-white px-2.5 py-0.5 text-xs text-teal-800 hover:bg-teal-100"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
