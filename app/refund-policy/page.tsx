import Link from "next/link";

export const metadata = {
  title: "Paid Mentorship Cancellation & Refunds | FieldsConnect",
  description: "How cancellation requests, paid mentorship disputes, and payment refunds are handled on FieldsConnect.",
};

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            <span className="text-blue-700">Fields</span>Connect
          </Link>
          <Link href="/contact" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50">Contact Us</Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Payments and customer care</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Paid Mentorship: Cancellations & Refunds</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          This policy explains how FieldsConnect (Pty) Ltd intends to handle cancellation and refund
          requests when paid mentorship becomes available. Paid mentorship payments are not currently enabled.
          Applicable transaction terms will be presented before any future payment.
        </p>

        <div className="mt-8 space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-bold">1. Payment processing and service delivery</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Paid mentorship is an online service between participating mentors and mentees, facilitated by
              FieldsConnect. There are no physical goods or shipping. Where available, payments will be
              processed through Paystack, and a mentorship will follow the agreed programme and schedule
              shown before purchase. The price, scope, any service start date and cancellation conditions
              applicable to the particular mentorship will be shown before payment.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-bold">2. Requesting a cancellation or refund</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              To request assistance, email <a href="mailto:support@fieldsconnect.app" className="font-semibold text-blue-700 underline">support@fieldsconnect.app</a> or
              use our <Link href="/contact" className="font-semibold text-blue-700 underline">Contact Us page</Link>.
              Include the mentorship name, payment reference if available, the reason for your request,
              and any relevant supporting information. Please do not send passwords or complete payment-card details.
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Requesting cancellation does not automatically reverse a payment, and stopping participation
              does not by itself establish refund eligibility. We will consider the timing, whether the
              service has begun or been delivered, the agreed terms, supporting evidence and any mandatory
              rights under applicable South African law.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-bold">3. Disputes and refund decisions</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Where a paid mentorship ends early or a dispute arises, FieldsConnect may review the
              mentorship record, relevant evidence and statements from the parties before deciding an
              appropriate remedy. Depending on the circumstances and the law, a request may result in
              a full refund, a partial refund, another agreed remedy, or no refund. We will communicate
              the decision and any next steps. A report against another user is not, by itself, proof
              of misconduct or an automatic entitlement to a refund.
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              A customer may raise concerns about a decision through our support channel. Nothing in
              this policy limits consumer rights or other remedies that cannot lawfully be excluded.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-bold">4. How approved refunds are processed</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              When an eligible refund is approved and the payment is supported by Paystack's refund
              process, FieldsConnect will initiate the authorised full or partial refund using the
              original payment reference. A refund is only complete after confirmation from the payment
              processor; an approval or pending status alone does not mean funds have reached the customer.
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Processing depends on the original payment method, the processor's eligibility rules,
              available refund funding and the receiving financial institution. Paystack indicates
              that customers generally receive completed refunds within 3–10 working days after
              initiation, although circumstances may vary. If the transaction cannot be refunded
              through Paystack, FieldsConnect will explain the next steps and assess lawful alternatives.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-xl font-bold">5. Contact</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              FieldsConnect (Pty) Ltd, 8 Beit Avenue, Farrar Park, Boksburg, 1459, South Africa.
              For service, cancellation, refund or payment enquiries, contact{" "}
              <a href="mailto:support@fieldsconnect.app" className="font-semibold text-blue-700 underline">support@fieldsconnect.app</a>.
            </p>
          </section>
        </div>

        <nav aria-label="Related policies" className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-slate-200 pt-6 text-sm text-blue-700">
          <Link href="/terms-of-use" className="hover:underline">Terms of Use</Link>
          <Link href="/privacy-policy" className="hover:underline">Privacy Policy</Link>
          <Link href="/code-of-conduct" className="hover:underline">Community Guidelines</Link>
          <Link href="/contact" className="hover:underline">Contact Us</Link>
        </nav>
      </div>
    </main>
  );
}
