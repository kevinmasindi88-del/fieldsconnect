import Link from "next/link";

const sections = [
  ["Information we process", "FieldsConnect may process your email, name, selected educational or professional field, profile information, connections, messages, mentorship activity, uploaded resources, reports and technical information needed to secure and operate the service. You decide which optional profile details to provide and content to share."],
  ["Why we process it", "We process information to manage accounts, deliver community and mentorship features, communicate with users, prevent fraud or abuse, moderate reports, secure the service and comply with applicable law. Where payments become available, relevant transactions may be processed by authorised payment providers."],
  ["Who may receive information", "Information shared publicly or with connections may be visible according to account settings. Authorised service providers may process necessary information to host, secure and support FieldsConnect. Private messages and confidential mentorship information are subject to the platform's access controls."],
  ["Learners and younger users", "Where a user's personal information is protected by child-specific laws, FieldsConnect must establish a lawful basis for its processing, including any prior consent of a legally competent person required by South Africa's POPIA. A general agreement alone does not establish that this consent has been obtained. Access may be restricted or further verification requested where required."],
  ["Your choices and concerns", "Depending on applicable law, you may request access to or correction of personal information, raise a privacy concern, or ask for restriction or deletion subject to applicable retention obligations. Use FieldsConnect's in-app support or feedback channel for privacy enquiries."],
] as const;

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-5 sm:p-10">
      <p className="text-sm font-medium text-blue-700">FieldsConnect governance</p>
      <h1 className="mt-2 text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-3 text-sm leading-6 text-gray-600">
        Proposed v1 for QA review. Confirm actual processing, service providers, retention and contact details before publishing as a production privacy notice.
      </p>
      <div className="mt-6 space-y-4">
        {sections.map(([heading, body]) => (
          <section key={heading} className="rounded-2xl border bg-white p-5">
            <h2 className="text-lg font-semibold">{heading}</h2>
            <p className="mt-2 text-sm leading-7 text-gray-700">{body}</p>
          </section>
        ))}
      </div>
      <Link href="/signup" className="mt-6 inline-block text-sm font-medium text-blue-700 underline">Back to signup</Link>
    </main>
  );
}
