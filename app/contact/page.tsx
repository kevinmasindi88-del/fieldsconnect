import Link from "next/link";
import { ContactForm } from "@/components/contact/ContactForm";

export const metadata = {
  title: "Contact Us | FieldsConnect",
  description: "Business information and customer support contact details for FieldsConnect (Pty) Ltd.",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            <span className="text-blue-700">Fields</span>Connect
          </Link>
          <Link href="/login" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50">Log in</Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-7 px-5 py-12 sm:px-8 sm:py-16">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Get in touch</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Contact Us</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Have a question or need help with FieldsConnect? Use the form below to prepare an email
            to our support team, or find our business contact details further down.
          </p>
        </div>

        <ContactForm />

        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8" aria-labelledby="business-details">
          <h2 id="business-details" className="text-xl font-bold">Business details</h2>
          <dl className="mt-6 grid gap-6 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-500">Registered business name</dt>
              <dd className="mt-2 text-base font-medium">FieldsConnect (Pty) Ltd</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Website</dt>
              <dd className="mt-2"><a href="https://fieldsconnect.app" className="text-base font-medium text-blue-700 underline underline-offset-2">fieldsconnect.app</a></dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Business address</dt>
              <dd className="mt-2 text-base leading-7">8 Beit Avenue<br />Farrar Park, Boksburg<br />1459, South Africa</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Customer support</dt>
              <dd className="mt-2 break-all"><a href="mailto:support@fieldsconnect.app" className="text-base font-medium text-blue-700 underline underline-offset-2">support@fieldsconnect.app</a></dd>
            </div>
          </dl>
        </section>


        <nav className="flex flex-wrap gap-x-6 gap-y-3 border-t border-slate-200 pt-6 text-sm" aria-label="Policies">
          <Link className="text-blue-700 hover:underline" href="/terms-of-use">Terms of Use</Link>
          <Link className="text-blue-700 hover:underline" href="/privacy-policy">Privacy Policy</Link>
          <Link className="text-blue-700 hover:underline" href="/code-of-conduct">Community Guidelines</Link>
            <Link className="text-blue-700 hover:underline" href="/refund-policy">Cancellations & Refunds</Link>
        </nav>
      </div>
    </main>
  );
}
