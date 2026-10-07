import { createClient } from "@supabase/supabase-js";

type PaystackWebhookEvent = {
  event?: unknown;
  data?: {
    reference?: unknown;
  } | null;
};

type PaystackVerifyResponse = {
  status?: boolean;
  message?: string;
  data?: {
    id?: unknown;
    domain?: unknown;
    status?: unknown;
    reference?: unknown;
    amount?: unknown;
    paid_at?: unknown;
    channel?: unknown;
    currency?: unknown;
    fees?: unknown;
  } | null;
};

type PaymentOrderLookup = {
  id: string;
  status: string;
};

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(
    bytes,
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

function constantTimeEqualHex(
  left: string,
  right: string,
): boolean {
  if (
    !/^[0-9a-f]+$/i.test(left) ||
    !/^[0-9a-f]+$/i.test(right) ||
    left.length !== right.length
  ) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |=
      left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

async function verifyPaystackSignature(
  payload: Uint8Array,
  suppliedSignature: string,
  secretKey: string,
): Promise<boolean> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    {
      name: "HMAC",
      hash: "SHA-512",
    },
    false,
    ["sign"],
  );

  const digest = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    payload,
  );

  const expectedSignature = bytesToHex(
    new Uint8Array(digest),
  );

  return constantTimeEqualHex(
    expectedSignature,
    suppliedSignature.trim().toLowerCase(),
  );
}

function normalizeReference(
  value: unknown,
): string | null {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9.=-]+$/.test(value)
  ) {
    return null;
  }

  return value;
}

/*
 * Paystack documents transaction IDs as unsigned 64-bit integers. JavaScript
 * numbers cannot safely represent the full uint64 range, so preserve the
 * integer token from the raw verification response rather than relying on
 * JSON number precision.
 */
function extractTransactionId(
  rawResponse: string,
): string | null {
  const dataIndex = rawResponse.search(/"data"\s*:/);

  if (dataIndex < 0) {
    return null;
  }

  const dataSection = rawResponse.slice(dataIndex);

  const idMatch = dataSection.match(
    /"id"\s*:\s*(?:"([0-9]+)"|([0-9]+))/,
  );

  return idMatch?.[1] ?? idMatch?.[2] ?? null;
}

function asSafeNonNegativeInteger(
  value: unknown,
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return null;
  }

  return value;
}

function asIsoTimestamp(
  value: unknown,
): string | null {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    return null;
  }

  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "method_not_allowed",
      },
      405,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const paystackSecretKey =
    Deno.env.get("PAYSTACK_SECRET_KEY");

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !paystackSecretKey
  ) {
    console.error(
      "paystack-mentorship-webhook is missing required environment variables.",
    );

    return jsonResponse(
      {
        ok: false,
        error: "webhook_not_configured",
      },
      500,
    );
  }

  const suppliedSignature =
    req.headers.get("x-paystack-signature");

  if (!suppliedSignature) {
    return jsonResponse(
      {
        ok: false,
        error: "missing_signature",
      },
      401,
    );
  }

  let rawPayload: Uint8Array;

  try {
    rawPayload = new Uint8Array(
      await req.arrayBuffer(),
    );
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: "invalid_request_body",
      },
      400,
    );
  }

  let signatureIsValid = false;

  try {
    signatureIsValid = await verifyPaystackSignature(
      rawPayload,
      suppliedSignature,
      paystackSecretKey,
    );
  } catch (error) {
    console.error(
      "Unable to verify Paystack webhook signature:",
      error,
    );

    return jsonResponse(
      {
        ok: false,
        error: "signature_verification_failed",
      },
      500,
    );
  }

  if (!signatureIsValid) {
    return jsonResponse(
      {
        ok: false,
        error: "invalid_signature",
      },
      401,
    );
  }

  let event: PaystackWebhookEvent;

  try {
    event = JSON.parse(
      new TextDecoder().decode(rawPayload),
    ) as PaystackWebhookEvent;
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: "invalid_json",
      },
      400,
    );
  }

  if (event.event !== "charge.success") {
    return jsonResponse({
      ok: true,
      state: "ignored",
    });
  }

  const reference = normalizeReference(
    event.data?.reference,
  );

  if (!reference) {
    console.error(
      "Signed Paystack charge.success event has an invalid reference.",
    );

    return jsonResponse(
      {
        ok: false,
        error: "invalid_transaction_reference",
      },
      400,
    );
  }

  /*
   * The signed webhook is the notification signal. Fulfillment still uses
   * Paystack's Verify Transaction endpoint as the authoritative payment
   * record before any mentorship is activated.
   */
  let verificationResponse: Response;

  try {
    verificationResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${
        encodeURIComponent(reference)
      }`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Cache-Control": "no-cache",
        },
      },
    );
  } catch (error) {
    console.error(
      "Paystack transaction verification request failed:",
      error,
    );

    return jsonResponse(
      {
        ok: false,
        error: "paystack_verification_unreachable",
      },
      502,
    );
  }

  const verificationRaw =
    await verificationResponse.text();

  let verification:
    | PaystackVerifyResponse
    | null = null;

  try {
    verification =
      JSON.parse(verificationRaw) as PaystackVerifyResponse;
  } catch {
    console.error(
      "Paystack returned a non-JSON transaction verification response.",
      {
        status: verificationResponse.status,
        reference,
      },
    );

    return jsonResponse(
      {
        ok: false,
        error: "invalid_paystack_verification_response",
      },
      502,
    );
  }

  if (
    !verificationResponse.ok ||
    verification.status !== true ||
    !verification.data ||
    verification.data.status !== "success"
  ) {
    console.error(
      "Paystack did not verify the transaction as successful.",
      {
        status: verificationResponse.status,
        reference,
        providerStatus:
          verification.data?.status ?? null,
        message: verification.message ?? null,
      },
    );

    return jsonResponse(
      {
        ok: false,
        error: "transaction_not_verified",
      },
      502,
    );
  }

  const verifiedReference = normalizeReference(
    verification.data.reference,
  );
  const transactionId =
    extractTransactionId(verificationRaw);
  const amountMinor =
    asSafeNonNegativeInteger(verification.data.amount);
  const processorFeeMinor =
    verification.data.fees === null ||
      verification.data.fees === undefined
      ? null
      : asSafeNonNegativeInteger(
        verification.data.fees,
      );
  const paidAt =
    asIsoTimestamp(verification.data.paid_at);
  const currency =
    typeof verification.data.currency === "string"
      ? verification.data.currency.trim().toUpperCase()
      : null;
  const channel =
    typeof verification.data.channel === "string" &&
      verification.data.channel.trim().length > 0
      ? verification.data.channel.trim()
      : null;

  if (
    verifiedReference !== reference ||
    !transactionId ||
    amountMinor === null ||
    amountMinor <= 0 ||
    !paidAt ||
    currency !== "ZAR" ||
    (
      verification.data.fees !== null &&
      verification.data.fees !== undefined &&
      processorFeeMinor === null
    )
  ) {
    console.error(
      "Verified Paystack transaction failed FieldsConnect validation.",
      {
        reference,
        verifiedReference,
        hasTransactionId: Boolean(transactionId),
        amountMinor,
        currency,
        hasPaidAt: Boolean(paidAt),
      },
    );

    return jsonResponse(
      {
        ok: false,
        error: "invalid_verified_transaction",
      },
      502,
    );
  }

  const adminClient = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const {
    data: order,
    error: orderError,
  } = await adminClient
    .from("mentorship_payment_orders")
    .select("id, status")
    .eq("provider_reference", reference)
    .maybeSingle<PaymentOrderLookup>();

  if (orderError) {
    console.error(
      "Unable to resolve mentorship payment order from Paystack reference:",
      {
        reference,
        error: orderError,
      },
    );

    return jsonResponse(
      {
        ok: false,
        error: "payment_order_lookup_failed",
      },
      500,
    );
  }

  /*
   * The Paystack integration may eventually process transaction types other
   * than mentorships. A valid signed event whose reference is not a
   * mentorship order should therefore be acknowledged and ignored rather
   * than retried for 72 hours.
   */
  if (!order) {
    return jsonResponse({
      ok: true,
      state: "ignored",
      reason: "not_a_mentorship_payment",
    });
  }

  const {
    data: finalizeData,
    error: finalizeError,
  } = await adminClient.rpc(
    "finalize_mentorship_payment_v1",
    {
      target_order_id: order.id,
      target_provider_reference: reference,
      target_provider_transaction_id: transactionId,
      target_provider_channel: channel,
      target_provider_amount_minor: amountMinor,
      target_provider_currency: currency,
      target_processor_fee_amount_minor:
        processorFeeMinor,
      target_provider_paid_at: paidAt,
    },
  );

  if (finalizeError) {
    console.error(
      "Verified Paystack transaction could not be finalized:",
      {
        orderId: order.id,
        reference,
        error: finalizeError,
      },
    );

    /*
     * Return a non-2xx status so Paystack retries a valid event when the
     * failure may be transient. The database fulfillment RPC is idempotent.
     */
    return jsonResponse(
      {
        ok: false,
        error: "payment_finalization_failed",
      },
      500,
    );
  }

  if (
    typeof finalizeData !== "object" ||
    finalizeData === null ||
    Array.isArray(finalizeData)
  ) {
    console.error(
      "Payment fulfillment RPC returned an unexpected response.",
      {
        orderId: order.id,
        reference,
      },
    );

    return jsonResponse(
      {
        ok: false,
        error: "invalid_payment_finalization_response",
      },
      500,
    );
  }

  const finalized =
    finalizeData as Record<string, unknown>;

  const finalState =
    typeof finalized.state === "string"
      ? finalized.state
      : null;

  if (
    finalState !== "paid" &&
    finalState !== "review_required"
  ) {
    console.error(
      "Payment fulfillment RPC returned an unsupported state.",
      {
        orderId: order.id,
        reference,
        finalState,
      },
    );

    return jsonResponse(
      {
        ok: false,
        error: "unexpected_payment_state",
      },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    state: finalState,
    orderId: order.id,
    mentorshipId:
      typeof finalized.mentorship_id === "string"
        ? finalized.mentorship_id
        : null,
    reason:
      typeof finalized.reason === "string"
        ? finalized.reason
        : null,
    idempotent:
      finalized.idempotent === true,
  });
});
