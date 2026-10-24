import Link from "next/link";

const sections = [
  ["Using FieldsConnect", "FieldsConnect helps learners, students, mentors and professionals connect, share knowledge and participate in mentorship. You must provide truthful account information, follow the Community Guidelines and use the platform lawfully."],
  ["Eligibility and necessary permissions", "You must have legal authority and any permissions necessary to participate. Where you are under 18 or applicable law otherwise requires it, permission from a parent, guardian or other legally competent person may be necessary before FieldsConnect may process your personal information or enable interaction. A general account declaration does not replace legally required consent. FieldsConnect may restrict or suspend access until applicable requirements are met."],
  ["Accounts and community safety", "You are responsible for protecting your login, respecting other users and their privacy, and reporting unsafe conduct. FieldsConnect may moderate content and suspend accounts to protect the community in accordance with its published rules."],
  ["Mentorship and payments", "Mentors and mentees are responsible for truthful profiles and communications. Paid mentorships, where available, require separate disclosed pricing and transaction terms. FieldsConnect does not promise employment, earnings or specific educational outcomes."],
  ["Changes and concerns", "We may update these terms with appropriate notice. If you have questions about account permissions, safety, privacy or access to your information, contact FieldsConnect through its in-app support or feedback channels."],
] as const;

export default function TermsOfUsePage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-5 sm:p-10">
      <p className="text-sm font-medium text-blue-700">FieldsConnect governance</p>
      <h1 className="mt-2 text-3xl font-bold">Terms of Use</h1>
      <p className="mt-3 text-sm leading-6 text-gray-600">
        Proposed v1 for QA review. This text requires legal and business approval before it can be published as binding production terms.
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
