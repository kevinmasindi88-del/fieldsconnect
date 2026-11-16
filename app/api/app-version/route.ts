// This endpoint must never be cached: existing app sessions compare its
// deployment identifier against the one rendered with their current bundle.
export const dynamic = "force-dynamic";

export function GET() {
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_URL ||
    "local";

  return Response.json(
    { version },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}
