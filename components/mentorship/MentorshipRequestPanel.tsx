"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser";
import { getActionErrorMessage, getMessageAlertClass } from "@/lib/action-errors";

type Duration = "3_months" | "6_months" | "1_year" | "ongoing";
type Frequency = "weekly" | "fortnightly" | "monthly" | "flexible";
type MentorSettings = {
  mentoring_fields: string[];
  mentoring_levels: string[];
  accepts_3_month: boolean;
  accepts_6_month: boolean;
  accepts_1_year: boolean;
  accepts_ongoing: boolean;
  is_accepting_requests: boolean;
};
type Offer = {
  duration: Duration;
  payment_mode: "free" | "paid";
  price_amount_minor: number;
  currency: string;
  is_active: boolean;
};
const publicPaymentsEnabled = process.env.NEXT_PUBLIC_FC_PAID_MENTORSHIPS_ENABLED === "true";
const periods: { key: Duration; label: string; allowed: keyof MentorSettings }[] = [
  { key: "3_months", label: "3 months", allowed: "accepts_3_month" },
  { key: "6_months", label: "6 months", allowed: "accepts_6_month" },
  { key: "1_year", label: "1 year", allowed: "accepts_1_year" },
  { key: "ongoing", label: "Full-time / ongoing", allowed: "accepts_ongoing" },
];

export function MentorshipRequestPanel({
  mentorId,
  mentorName,
  currentUserId,
  onClose,
  onSent,
}: {
  mentorId: string;
  mentorName: string;
  currentUserId: string | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const [settings, setSettings] = useState<MentorSettings | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [level, setLevel] = useState("");
  const [field, setField] = useState("");
  const [objective, setObjective] = useState("");
  const [motivation, setMotivation] = useState("");
  const [duration, setDuration] = useState<Duration>("3_months");
  const [frequency, setFrequency] = useState<Frequency>("flexible");

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!isSupabaseConfigured()) {
      setErrorMessage("Unable to load mentorship settings.");
      setLoading(false);
      return;
    }
    let active = true;
    async function load() {
      try {
        const db = getSupabaseBrowserClient();
        const [mentorResult, offersResult] = await Promise.all([
          db.from("mentor_profiles")
            .select("mentoring_fields, mentoring_levels, accepts_3_month, accepts_6_month, accepts_1_year, accepts_ongoing, is_accepting_requests")
            .eq("mentor_id", mentorId).maybeSingle(),
          db.from("mentorship_payment_offers")
            .select("duration, payment_mode, price_amount_minor, currency, is_active")
            .eq("mentor_id", mentorId).order("created_at", { ascending: true }),
        ]);
        if (mentorResult.error) throw mentorResult.error;
        if (offersResult.error) throw offersResult.error;
        if (!active) return;
        setSettings(mentorResult.data as MentorSettings | null);
        setOffers((offersResult.data ?? []) as Offer[]);
      } catch (error) {
        if (active) setErrorMessage(getActionErrorMessage(error, "load mentorship settings"));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [mentorId]);

  // Mirror the existing request form on a mentor's profile.
  const availablePeriods = useMemo(() => {
    if (!settings) return [];
    return periods.flatMap((period) => {
      if (!settings[period.allowed]) return [];
      const activeOffer = offers.find((o) => o.duration === period.key && o.is_active);
      if (!activeOffer && offers.length > 0) return [];
      if (!activeOffer) return [{ value: period.key, label: `${period.label} · Free` }];
      if (activeOffer.payment_mode === "free" || activeOffer.price_amount_minor === 0) {
        return [{ value: period.key, label: `${period.label} · Free` }];
      }
      if (!publicPaymentsEnabled) return [];
      const price = new Intl.NumberFormat("en-ZA", { style: "currency", currency: activeOffer.currency })
        .format(activeOffer.price_amount_minor / 100);
      return [{ value: period.key, label: `${period.label} · ${price}` }];
    });
  }, [settings, offers]);

  const selectedPeriod = availablePeriods.some((p) => p.value === duration)
    ? duration : availablePeriods[0]?.value;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    if (!currentUserId) return setErrorMessage("Please log in before requesting mentorship.");
    if (currentUserId === mentorId) return setErrorMessage("You cannot request mentorship from yourself.");
    if (!settings?.is_accepting_requests) return setErrorMessage("This mentor is not currently accepting requests.");
    if (field.trim().length < 2 || field.trim().length > 120)
      return setErrorMessage("Mentorship field must be between 2 and 120 characters.");
    if (objective.trim().length < 10 || objective.trim().length > 1000)
      return setErrorMessage("Objective must be between 10 and 1,000 characters.");
    if (motivation.trim().length < 10 || motivation.trim().length > 1500)
      return setErrorMessage("Motivation must be between 10 and 1,500 characters.");
    if (!level || !settings.mentoring_levels.includes(level))
      return setErrorMessage("Select a mentorship level offered by this mentor.");
    if (!selectedPeriod || !availablePeriods.some((p) => p.value === selectedPeriod))
      return setErrorMessage("Select a mentorship period accepted by this mentor.");
    setSending(true);
    try {
      const { error } = await getSupabaseBrowserClient().rpc("create_mentorship_request", {
        target_mentor_id: mentorId,
        requested_mentorship_field: field.trim(),
        requested_objective: objective.trim(),
        requested_motivation: motivation.trim(),
        requested_period: selectedPeriod,
        requested_contact_frequency: frequency,
        requested_mentorship_level: level,
      });
      if (error) throw error;
      setSent(true);
      onSent();
    } catch (error) {
      setErrorMessage(getActionErrorMessage(error, "send mentorship request"));
    } finally {
      setSending(false);
    }
  }

  return (
    <section ref={panelRef} id="mentorship-request-form" aria-label={`Request mentorship from ${mentorName}`}
      className="scroll-mt-28 rounded-2xl border border-gray-300 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Request mentorship from {mentorName}</h3>
          <p className="mt-1 text-sm text-gray-600">Explain what you hope to achieve through this mentorship.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close mentorship request"
          className="shrink-0 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50">Close</button>
      </div>
      {errorMessage && <p role="alert" className={`mt-3 ${getMessageAlertClass(errorMessage)}`}>{errorMessage}</p>}
      {loading ? (
        <p className="mt-4 text-sm text-gray-600">Loading mentor settings...</p>
      ) : sent ? (
        <p role="status" className="mt-4 rounded-xl border p-4 text-sm font-medium">Mentorship request sent successfully.</p>
      ) : !settings?.is_accepting_requests ? (
        <p className="mt-4 rounded-xl border p-4 text-sm">This mentor is not currently accepting requests.</p>
      ) : availablePeriods.length === 0 ? (
        <p className="mt-4 rounded-xl border p-4 text-sm">No mentorship periods are currently available to request.</p>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="mt-4 grid gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Mentorship level
            <select required value={level} onChange={(event) => setLevel(event.target.value)}
              className="min-h-11 rounded-lg border bg-white px-3 py-2">
              <option value="">Select a mentorship level</option>
              {settings.mentoring_levels.map((value) => (
                <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Mentorship field
            <select required value={field} onChange={(event) => setField(event.target.value)}
              className="min-h-11 rounded-lg border bg-white px-3 py-2">
              <option value="">Select a field</option>
              {settings.mentoring_fields.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Objective
            <textarea required minLength={10} maxLength={1000} value={objective}
              onChange={(event) => setObjective(event.target.value)}
              placeholder="What specific outcome would you like to achieve through this mentorship?"
              className="min-h-28 rounded-lg border px-3 py-2" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Motivation
            <textarea required minLength={10} maxLength={1500} value={motivation}
              onChange={(event) => setMotivation(event.target.value)}
              placeholder="Why are you requesting mentorship from this person, and what commitment will you bring?"
              className="min-h-28 rounded-lg border px-3 py-2" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Requested period
              <select value={selectedPeriod ?? ""} onChange={(event) => setDuration(event.target.value as Duration)}
                className="min-h-11 rounded-lg border bg-white px-3 py-2">
                {availablePeriods.map((period) => <option key={period.value} value={period.value}>{period.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Preferred contact frequency
              <select value={frequency} onChange={(event) => setFrequency(event.target.value as Frequency)}
                className="min-h-11 rounded-lg border bg-white px-3 py-2">
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Every two weeks</option>
                <option value="monthly">Monthly</option>
                <option value="flexible">Flexible</option>
              </select>
            </label>
          </div>
          <button disabled={sending} type="submit"
            className="min-h-11 w-fit rounded-xl bg-gray-950 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {sending ? "Sending request..." : "Send mentorship request"}
          </button>
        </form>
      )}
    </section>
  );
}
