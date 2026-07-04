export default function HomePage() {
  return (
    <main className="min-h-screen p-8">
      <section className="mx-auto flex max-w-3xl flex-col gap-6 py-20">
        <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
          FieldsConnect MVP
        </p>

        <h1 className="text-4xl font-bold tracking-tight">
          Connect with mentors, professionals, and opportunities.
        </h1>

        <p className="text-lg text-gray-600">
          FieldsConnect is a controlled MVP platform for mentorship, professional discovery,
          trusted connections, and simple accepted-connection-only messaging.
        </p>

        <a
          href="/health"
          className="w-fit rounded-lg border px-4 py-2 text-sm font-medium"
        >
          View health check
        </a>
      </section>
    </main>
  );
}
