import Link from "next/link";

export const metadata = {
  title: "Guardian-assisted registration | FieldsConnect",
  description: "Information for parents and guardians of younger FieldsConnect learners.",
  robots: { index: false, follow: false },
};

export default function GuardianRegistrationPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6">
      <section className="mx-auto w-full max-w-xl space-y-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-9">
        <Link href="/" className="inline-flex text-2xl font-bold tracking-tight" aria-label="FieldsConnect home">
          <span className="text-blue-700">Fields</span><span className="text-gray-950">Connect</span>
        </Link>
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-950">Guardian-assisted registration</h1>
          <p className="leading-7 text-gray-700">
            FieldsConnect welcomes the interest of young learners. Members under 18 require
            appropriate authorisation from a parent or legally competent guardian before
            their networking account can be activated.
          </p>
          <p className="leading-7 text-gray-700">
            The secure guardian approval process is not yet available. We are not collecting
            a guardian&apos;s personal details or registering an under-18 member through this page
            until that process is ready.
          </p>
          <p className="leading-7 text-gray-700">
            You may contact the FieldsConnect team using our public channels for information
            on younger learner access. Please do not send identification documents,
            birth dates or sensitive details through ordinary messages.
          </p>
        </div>
        <div className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          Adult members aged 18 or older can return to standard signup and confirm their
          age there. No routine date-of-birth or identity-document upload is required.
        </div>
        <Link href="/signup" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800">
          Back to signup
        </Link>
      </section>
    </main>
  );
}
