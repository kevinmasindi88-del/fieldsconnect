import { createClient } from "@supabase/supabase-js";

type InitializeRequest = {
  orderId?: unknown;
};

type PrepareResult = {
  state: string;
  order_id?: string;
  mentorship_id?: string | null;
  reference?: string;
  amount_minor?: number;
  currency?: string;
  platform_fee_amount_minor?: number;
  subaccount_code?: string;
  payment_expires_at?: string;
  authorization_url?: string | null;
  access_code?: string | null;
  initialized_at?: string | null;
};

type PaystackInitializeResponse = {
  status?: boolean;
  message?: string;
  data?: {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function createPaystackReference(): string {
  return `FCM-${crypto.randomUUID().replaceAll("-", "")}`;
}

function getCallbackUrl(orderId: string): string {
  const configuredOrigin =
    Deno.env.get("APP_ORIGIN")?.trim() || "https://fieldsconnect.app";

  const url = new URL("/connections", configuredOrigin);
  url.searchParams.set("payment", "return");
  url.searchParams.set("order", orderId);

  return url.toString();
}

function normalizePrepareResult(value: unknown): PrepareResult | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as PrepareResult;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");

  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceRoleKey ||
    !paystackSecretKey
  ) {
    console.error(
      "initialize-mentorship-payment is missing required environment variables.",
    );

    return jsonResponse(
      {
        ok: false,
        error: "payment_service_not_configured",
      },
      500,
    );
  }

  const authorization = req.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse(
      {
        ok: false,
        error: "authentication_required",
      },
      401,
    );
  }

  const accessToken = authorization.slice("Bearer ".length).trim();

  if (!accessToken) {
    return jsonResponse(
      {
        ok: false,
        error: "authentication_required",
      },
      401,
    );
  }

  let payload: InitializeRequest;

  try {
    payload = (await req.json()) as InitializeRequest;
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: "invalid_json",
      },
      400,
    );
  }

  if (!isUuid(payload.orderId)) {
    return jsonResponse(
      {
        ok: false,
        error: "invalid_order_id",
      },
      400,
    );
  }

  const orderId = payload.orderId;

  const userClient = createClient(
    supabaseUrl,
    anonKey,
    {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(accessToken);

  if (userError || !user) {
    return jsonResponse(
      {
        ok: false,
        error: "invalid_session",
      },
      401,
    );
  }

  if (!user.email) {
    return jsonResponse(
      {
        ok: false,
        error: "payer_email_required",
      },
      400,
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

  const proposedReference = createPaystackReference();

  const {
    data: prepareData,
    error: prepareError,
  } = await adminClient.rpc(
    "prepare_mentorship_payment_initialization_v1",
    {
      target_order_id: orderId,
      target_payer_id: user.id,
      target_provider_reference: proposedReference,
    },
  );

  if (prepareError) {
    console.error(
      "Unable to prepare mentorship payment initialization:",
      prepareError,
    );

    return jsonResponse(
      {
        ok: false,
        error: "payment_initialization_not_available",
      },
      409,
    );
  }

  const prepared = normalizePrepareResult(prepareData);

  if (!prepared || typeof prepared.state !== "string") {
    console.error(
      "Payment preparation returned an unexpected response.",
      prepareData,
    );

    return jsonResponse(
      {
        ok: false,
        error: "invalid_payment_preparation",
      },
      500,
    );
  }

  if (prepared.state === "paid") {
    return jsonResponse({
      ok: true,
      state: "paid",
      orderId: prepared.order_id ?? orderId,
      mentorshipId: prepared.mentorship_id ?? null,
    });
  }

  if (prepared.state === "expired") {
    return jsonResponse(
      {
        ok: false,
        state: "expired",
        orderId: prepared.order_id ?? orderId,
        error: "payment_window_expired",
      },
      410,
    );
  }

  if (prepared.state !== "ready") {
    return jsonResponse(
      {
        ok: false,
        state: prepared.state,
        orderId: prepared.order_id ?? orderId,
        error: "payment_not_initializable",
      },
      409,
    );
  }

  if (
    prepared.authorization_url &&
    prepared.access_code
  ) {
    return jsonResponse({
      ok: true,
      state: "initialized",
      orderId: prepared.order_id ?? orderId,
      reference: prepared.reference ?? null,
      authorizationUrl: prepared.authorization_url,
      accessCode: prepared.access_code,
      paymentExpiresAt: prepared.payment_expires_at ?? null,
      cached: true,
    });
  }

  if (
    prepared.authorization_url ||
    prepared.access_code
  ) {
    console.error(
      "Payment initialization cache is internally inconsistent.",
      {
        orderId,
        hasAuthorizationUrl: Boolean(prepared.authorization_url),
        hasAccessCode: Boolean(prepared.access_code),
      },
    );

    return jsonResponse(
      {
        ok: false,
        error: "payment_initialization_inconsistent",
      },
      500,
    );
  }

  if (
    typeof prepared.reference !== "string" ||
    !/^[A-Za-z0-9.=-]+$/.test(prepared.reference) ||
    !Number.isInteger(prepared.amount_minor) ||
    (prepared.amount_minor ?? 0) <= 0 ||
    prepared.currency !== "ZAR" ||
    !Number.isInteger(prepared.platform_fee_amount_minor) ||
    (prepared.platform_fee_amount_minor ?? -1) < 0 ||
    (prepared.platform_fee_amount_minor ?? 0) >
      (prepared.amount_minor ?? 0) ||
    typeof prepared.subaccount_code !== "string" ||
    prepared.subaccount_code.trim().length === 0
  ) {
    console.error(
      "Payment preparation data failed server-side validation.",
      {
        orderId,
        state: prepared.state,
        currency: prepared.currency,
      },
    );

    return jsonResponse(
      {
        ok: false,
        error: "invalid_payment_economics",
      },
      500,
    );
  }

  const paystackRequest = {
    email: user.email,
    amount: String(prepared.amount_minor),
    currency: prepared.currency,
    reference: prepared.reference,
    callback_url: getCallbackUrl(orderId),
    subaccount: prepared.subaccount_code,
    transaction_charge: prepared.platform_fee_amount_minor,
    bearer: "account",
    metadata: JSON.stringify({
      fieldsconnect: {
        purpose: "mentorship_payment_v1",
        order_id: orderId,
      },
    }),
  };

  let paystackResponse: Response;

  try {
    paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paystackRequest),
      },
    );
  } catch (error) {
    console.error(
      "Paystack transaction initialization request failed:",
      error,
    );

    return jsonResponse(
      {
        ok: false,
        error: "paystack_unreachable",
      },
      502,
    );
  }

  let paystackPayload: PaystackInitializeResponse;

  try {
    paystackPayload =
      (await paystackResponse.json()) as PaystackInitializeResponse;
  } catch {
    console.error(
      "Paystack returned a non-JSON initialization response.",
      {
        status: paystackResponse.status,
        orderId,
      },
    );

    return jsonResponse(
      {
        ok: false,
        error: "invalid_paystack_response",
      },
      502,
    );
  }

  if (
    !paystackResponse.ok ||
    paystackPayload.status !== true
  ) {
    /*
     * A concurrent request may have initialized the same reserved reference
     * first. Re-read our private cache before reporting a provider failure.
     */
    const {
      data: retryData,
      error: retryError,
    } = await adminClient.rpc(
      "prepare_mentorship_payment_initialization_v1",
      {
        target_order_id: orderId,
        target_payer_id: user.id,
        target_provider_reference: prepared.reference,
      },
    );

    const retried = normalizePrepareResult(retryData);

    if (
      !retryError &&
      retried?.state === "ready" &&
      retried.authorization_url &&
      retried.access_code
    ) {
      return jsonResponse({
        ok: true,
        state: "initialized",
        orderId: retried.order_id ?? orderId,
        reference: retried.reference ?? prepared.reference,
        authorizationUrl: retried.authorization_url,
        accessCode: retried.access_code,
        paymentExpiresAt: retried.payment_expires_at ?? null,
        cached: true,
      });
    }

    console.error(
      "Paystack rejected mentorship payment initialization.",
      {
        status: paystackResponse.status,
        orderId,
        message: paystackPayload.message ?? null,
      },
    );

    return jsonResponse(
      {
        ok: false,
        error: "paystack_initialization_failed",
      },
      502,
    );
  }

  const authorizationUrl =
    paystackPayload.data?.authorization_url;
  const accessCode = paystackPayload.data?.access_code;
  const returnedReference = paystackPayload.data?.reference;

  if (
    typeof authorizationUrl !== "string" ||
    !authorizationUrl.startsWith(
      "https://checkout.paystack.com/",
    ) ||
    typeof accessCode !== "string" ||
    accessCode.trim().length === 0 ||
    returnedReference !== prepared.reference
  ) {
    console.error(
      "Paystack initialization response failed validation.",
      {
        orderId,
        returnedReference: returnedReference ?? null,
      },
    );

    return jsonResponse(
      {
        ok: false,
        error: "invalid_paystack_initialization",
      },
      502,
    );
  }

  let recordData: unknown = null;
  let recordError: unknown = null;

  /*
   * The external payment initialization and our database write cannot share
   * one transaction. Retry the database write briefly so a transient database
   * error does not strand a successfully-created Paystack checkout.
   */
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await adminClient.rpc(
      "record_mentorship_payment_initialization_v1",
      {
        target_order_id: orderId,
        target_provider_reference: prepared.reference,
        target_authorization_url: authorizationUrl,
        target_access_code: accessCode,
      },
    );

    recordData = result.data;
    recordError = result.error;

    if (!recordError) {
      break;
    }

    if (attempt < 2) {
      await new Promise((resolve) =>
        setTimeout(resolve, 150 * (attempt + 1))
      );
    }
  }

  if (recordError) {
    console.error(
      "Paystack checkout was created but could not be recorded.",
      {
        orderId,
        reference: prepared.reference,
        error: recordError,
      },
    );

    return jsonResponse(
      {
        ok: false,
        error: "payment_checkout_record_failed",
        reference: prepared.reference,
      },
      500,
    );
  }

  const recorded = normalizePrepareResult(recordData);

  if (
    !recorded ||
    recorded.state !== "initialized"
  ) {
    console.error(
      "Payment initialization recording returned an unexpected response.",
      recordData,
    );

    return jsonResponse(
      {
        ok: false,
        error: "invalid_payment_recording_response",
      },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    state: "initialized",
    orderId: recorded.order_id ?? orderId,
    reference: recorded.reference ?? prepared.reference,
    authorizationUrl:
      recorded.authorization_url ?? authorizationUrl,
    accessCode:
      recorded.access_code ?? accessCode,
    paymentExpiresAt: prepared.payment_expires_at ?? null,
    cached: false,
  });
});
