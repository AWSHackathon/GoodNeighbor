"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getRequestThread,
  postThreadMessage,
} from "@/lib/api/client";
import { getIdToken } from "@/lib/auth/session";
import type { PrivateThread, ThreadMessage } from "@/lib/types/domain";

type RequestThreadViewProps = {
  requestId: string;
};

export function RequestThreadView({ requestId }: RequestThreadViewProps) {
  const [thread, setThread] = useState<PrivateThread | null>(null);
  const [mySub, setMySub] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const session = await import("aws-amplify/auth").then((m) =>
        m.fetchAuthSession(),
      );
      const sub = session.tokens?.idToken?.payload?.sub;
      setMySub(typeof sub === "string" ? sub : null);
      const data = await getRequestThread(token, requestId);
      setThread(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Thread unavailable — accept a helper offer first",
      );
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setSending(true);
    try {
      const token = await getIdToken();
      const msg = await postThreadMessage(token, requestId, text);
      setThread((prev) =>
        prev
          ? { ...prev, messages: [...prev.messages, msg] }
          : prev,
      );
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <p className="mt-6 text-sm text-slate-500">Loading thread…</p>;
  }

  if (error || !thread) {
    return (
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {error ?? "Thread not found"}
        <p className="mt-2">
          <Link href="/map" className="font-medium text-teal-700 hover:underline">
            Back to map
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="max-h-80 flex-1 space-y-3 overflow-y-auto p-4">
        {thread.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isMine={msg.senderSub === mySub} />
        ))}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={handleSend}
        className="flex gap-2 border-t border-slate-100 p-3"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Exact meet-up details, address, time…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function MessageBubble({
  message,
  isMine,
}: {
  message: ThreadMessage;
  isMine: boolean;
}) {
  const isSystem = message.senderSub === "system";
  if (isSystem) {
    return (
      <p className="text-center text-xs italic text-slate-500">{message.body}</p>
    );
  }

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
          isMine
            ? "bg-teal-600 text-white"
            : "bg-slate-100 text-slate-800"
        }`}
      >
        {message.body}
      </div>
    </div>
  );
}
