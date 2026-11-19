"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";

export type MentionCandidate = {
  profile_id: string;
  display_name: string;
  username: string | null;
  field: string | null;
  avatar_url: string | null;
};

type ActiveMention = { start: number; end: number; query: string };

function mentionAtCaret(value: string, caret: number): ActiveMention | null {
  const before = value.slice(0, caret);
  // Start at a word boundary, not inside email addresses or URL fragments.
  const match = /(^|[\s(])@([^@\n]{0,48})$/u.exec(before);
  if (!match) return null;
  const query = match[2];
  // Keep suggestions focused on a name, not entire prose after a mention.
  if (query.trim().split(/\s+/).length > 3 || /[.,!?;:]$/.test(query)) return null;
  return { start: caret - query.length - 1, end: caret, query: query.trim() };
}

export function MentionEditor({
  value, onChange, onSelect, placeholder, disabled, multiline = true, className = "",
  mentionCount = 0, maxMentions = 10, selectedMentions = [],
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (person: MentionCandidate, newValue: string) => void;
  placeholder: string;
  disabled?: boolean;
  multiline?: boolean;
  className?: string;
  mentionCount?: number;
  maxMentions?: number;
  selectedMentions?: MentionCandidate[];
}) {
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const [active, setActive] = useState<ActiveMention | null>(null);
  const [results, setResults] = useState<MentionCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!active || disabled || mentionCount >= maxMentions || !isSupabaseConfigured()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error } = await getSupabaseBrowserClient().rpc(
          "search_mentionable_connections",
          { search_term: active.query, result_limit: 20, result_offset: 0 }
        );
        if (error) throw error;
        if (!cancelled) setResults((data ?? []) as MentionCandidate[]);
      } catch (error) {
        console.error("Unable to find mentionable connections:", error);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [active?.start, active?.query, disabled, mentionCount, maxMentions]);

  function updateQuery(next: string, caret: number) {
    const match = mentionAtCaret(next, caret);
    const alreadySelected = match && selectedMentions.some((person) =>
      match.query === person.display_name || match.query.startsWith(person.display_name + " ")
    );
    setActive(alreadySelected ? null : match);
    setSelectedIndex(0);
  }

  function select(person: MentionCandidate) {
    if (!active || disabled || mentionCount >= maxMentions) return;
    const inserted = `@${person.display_name} `;
    const nextValue = value.slice(0, active.start) + inserted + value.slice(active.end);
    const position = active.start + inserted.length;
    onSelect(person, nextValue);
    setActive(null);
    setResults([]);
    window.requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(position, position);
    });
  }

  const shown = active && mentionCount < maxMentions ? results : [];
  const inputProps = {
    value, placeholder, disabled, className,
    onBlur: () => window.setTimeout(() => setActive(null), 150),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(event.target.value);
      updateQuery(event.target.value, event.target.selectionStart ?? event.target.value.length);
    },
    onClick: (event: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const el = event.currentTarget;
      updateQuery(el.value, el.selectionStart ?? el.value.length);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!active) return;
      if (event.key === "Escape") { setActive(null); setResults([]); return; }
      if (!shown.length) return;
      if (event.key === "ArrowDown") { event.preventDefault(); setSelectedIndex((i) => (i + 1) % shown.length); }
      if (event.key === "ArrowUp") { event.preventDefault(); setSelectedIndex((i) => (i - 1 + shown.length) % shown.length); }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        select(shown[Math.min(selectedIndex, shown.length - 1)]);
      }
    },
    "aria-autocomplete": "list" as const,
    "aria-expanded": Boolean(active && mentionCount < maxMentions),
    "aria-label": placeholder,
  };

  return (
    <div className="relative min-w-0 flex-1">
      {multiline
        ? <textarea {...inputProps} ref={ref as React.Ref<HTMLTextAreaElement>} />
        : <input {...inputProps} ref={ref as React.Ref<HTMLInputElement>} />}
      {active && mentionCount < maxMentions && (
        <div className={`absolute left-0 right-0 z-30 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl ${multiline ? "top-full mt-1" : "bottom-full mb-1"}`} role="listbox" aria-label="Mention a connection">
          {searching ? (
            <p className="px-3 py-2 text-sm text-gray-500">Finding connections...</p>
          ) : shown.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No matching connections</p>
          ) : shown.map((person, index) => (
            <button
              key={person.profile_id}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${index === selectedIndex ? "bg-blue-50" : "hover:bg-gray-50"}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(person)}
            >
              <ProfileAvatar avatarPath={person.avatar_url} displayName={person.display_name} size={32} />
              <span className="min-w-0">
                <span className="block truncate font-medium text-gray-950">{person.display_name}</span>
                {(person.username || person.field) && <span className="block truncate text-xs text-gray-500">{person.username ? `@${person.username}` : person.field}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
