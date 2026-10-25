"use client";

import { useState } from "react";
import Link from "next/link";

type Props = { checked: boolean; onChange: (checked: boolean) => void; id: string };

// Policy body remains v1; this component makes its disclosure clearer and
// integrates Community Guidelines into the same checkbox.
export const LEGAL_AGREEMENT_VERSION = "2026-10-24-v1";

export function LegalAgreementCheckbox({ checked, onChange, id }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-700">
      <div className="flex items-start gap-3">
        <input
          id={id}
          name="fc-terms-agreement"
          type="checkbox"
          required
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-blue-700"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="cursor-pointer text-sm text-gray-800">
            I agree to the FieldsConnect Terms & Conditions and Code of Conduct.
          </label>
          <button
            className="ml-2 inline-block text-sm font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            type="button"
            aria-controls={`${id}-details`}
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((value) => !value)}
          >
            {detailsOpen ? "Show less" : "Read more"}
          </button>
        </div>
      </div>
      {detailsOpen && (
        <div id={`${id}-details`} className="mt-3 border-t border-gray-200 pt-3 text-sm leading-6 text-gray-700">
          <p className="mb-2">
            The Terms explain your account, mentorship, payments and responsibilities.
            The Code of Conduct sets community safety standards. Our Privacy Policy
            explains how FieldsConnect uses and protects personal information.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 font-semibold text-blue-700">
            <Link href="/terms-of-use" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Terms & Conditions</Link>
            <Link href="/code-of-conduct" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">FC Code of Conduct</Link>
            <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Privacy Policy</Link>
          </div>
        </div>
      )}
    </div>
  );
}
