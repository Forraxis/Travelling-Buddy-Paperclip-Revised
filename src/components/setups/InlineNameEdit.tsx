"use client";

import { useRef, useState } from "react";

interface InlineNameEditProps {
  setupId: string;
  initialName: string;
  /** Called after a successful rename so the parent can update its state. */
  onRename?: (newName: string) => void;
  className?: string;
}

export function InlineNameEdit({
  setupId,
  initialName,
  onRename,
  className,
}: InlineNameEditProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(name);
    setEditing(true);
    // Focus happens via autoFocus on the input
  }

  function revert() {
    setDraft(name);
    setEditing(false);
  }

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/setups/${setupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Failed to rename setup");
      setName(trimmed);
      onRename?.(trimmed);
    } catch {
      // Revert draft on failure without showing name change
      setDraft(name);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      revert();
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={onKeyDown}
        disabled={saving}
        className={
          className ??
          "min-w-0 flex-1 rounded border border-blue-400 px-1 py-0.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
        }
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      title="Click to rename"
      className={
        className ??
        "group flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left text-sm font-semibold hover:bg-gray-100"
      }
    >
      <span className="truncate">{name}</span>
      <svg
        className="h-3 w-3 flex-shrink-0 text-gray-400 opacity-0 group-hover:opacity-100"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z" />
      </svg>
    </button>
  );
}
