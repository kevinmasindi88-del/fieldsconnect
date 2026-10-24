"use client";
import Link from "next/link";

type Props = { checked: boolean; onChange: (checked: boolean) => void; id: string };
export const LEGAL_AGREEMENT_VERSION = "2026-10-24-v1";

export function LegalAgreementCheckbox({ checked, onChange, id }: Props) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-700">
      <input id={id} type="checkbox" required checked={checked}
        aria-label="Agree to the FieldsConnect Terms of Use, Privacy Policy and Community Guidelines"
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-blue-700" />
      <span>
        <label htmlFor={id} className="cursor-pointer">
          I confirm that the information I have provided is accurate. I have read and agree to the FieldsConnect{" "}
        </label>
        <Link href="/terms-of-use" target="_blank" rel="noopener noreferrer"
          className="font-semibold text-blue-700 underline-offset-2 hover:underline focus-visible:underline">Terms of Use</Link>
        {", "}
        <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer"
          className="font-semibold text-blue-700 underline-offset-2 hover:underline focus-visible:underline">Privacy Policy</Link>
        {" and "}
        <Link href="/code-of-conduct" target="_blank" rel="noopener noreferrer"
          className="font-semibold text-blue-700 underline-offset-2 hover:underline focus-visible:underline">Community Guidelines</Link>.
      </span>
    </div>
  );
}
