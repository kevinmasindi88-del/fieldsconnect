import Link from "next/link";

const sections = [
  {
    title: "Respectful conduct",
    body: "Users must communicate professionally and must not harass, bully, threaten, intimidate, demean or target others on the basis of personal characteristics, identity, background or professional status.",
  },
  {
    title: "Truthful and lawful participation",
    body: "Users must not impersonate others, misrepresent qualifications, commit fraud, distribute scams, manipulate ratings, knowingly publish misleading information or use FieldsConnect for unlawful activity.",
  },
  {
    title: "Privacy and confidentiality",
    body: "Users must not disclose private, confidential or personally identifying information without authority. Confidential project, workplace, institutional or personal material must be handled responsibly.",
  },
  {
    title: "Content and resources",
    body: "Posts, comments, messages, profile pictures, skills information and library resources must not contain abusive, hateful, explicit, threatening, fraudulent, plagiarised, dangerous or otherwise prohibited material.",
  },
  {
    title: "Spam and platform misuse",
    body: "Spam, repeated unsolicited promotion, malicious reporting, attempts to bypass restrictions, account manipulation and interference with the safety or operation of the platform are prohibited.",
  },
];

export default function CodeOfConductPage() {
  return (
    <main className="mx-auto w-full max-w-4xl p-6 md:p-10">
      <div className="mb-8">
        <p className="text-sm font-medium text-blue-700">FieldsConnect governance</p>
        <h1 className="mt-1 text-3xl font-semibold">Code of Conduct</h1>
        <p className="mt-3 text-sm text-gray-600">
          This Code of Conduct applies to all FieldsConnect users, content, communications and resources. It guides both user behaviour and moderation decisions.
        </p>
      </div>

      <section className="grid gap-4">
        {sections.map((section) => (
          <article key={section.title} className="rounded-2xl border bg-white p-5">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-700">{section.body}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold">Moderation outcomes</h2>
        <p className="mt-2 text-sm leading-6 text-gray-700">
          Reports are reviewed against this Code. Outcomes may include dismissal, a warning, redaction or removal of content, deletion of an inappropriate profile image, a 12-day or 30-day suspension, temporary suspension pending review, or permanent account termination for severe or repeated violations.
        </p>
        <p className="mt-3 text-sm leading-6 text-gray-700">
          Redacted content may be replaced with a notice stating that it was removed for violating the FieldsConnect Code of Conduct. Moderation communications are sent under the shared identity <strong>FCModerators</strong> while the responsible moderator remains recorded internally for audit purposes.
        </p>
      </section>

      <section className="mt-8 rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold">Fairness, confidentiality and appeals</h2>
        <p className="mt-2 text-sm leading-6 text-gray-700">
          Moderators must act impartially, protect reporter identities, declare conflicts of interest and document material decisions. A report alone does not prove a violation. Serious enforcement decisions must be supported by recorded reasons and may be escalated or appealed through the moderation process.
        </p>
      </section>

      <div className="mt-8">
        <Link className="rounded-lg border px-4 py-2 text-sm font-medium" href="/moderation/nominations">
          Return to nomination
        </Link>
      </div>
    </main>
  );
}
