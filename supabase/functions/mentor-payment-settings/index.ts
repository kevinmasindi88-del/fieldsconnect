import { createClient } from "@supabase/supabase-js";

type RequestPayload = {
  action?: unknown;
  bankCode?: unknown;
  accountName?: unknown;
  accountNumber?: unknown;
};

type PaystackBank = {
  name?: string;
  code?: string;
  active?: boolean;
  currency?: string;
};

type PaystackListBanksResponse = {
  status?: boolean;
  message?: string;
  data?: PaystackBank[];
};

type PaystackSubaccountResponse = {
  status?: boolean;
  message?: string;
  data?: {
    subaccount_code?: string;
    active?: boolean;
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
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function isBankCode(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{2,20}$/.test(value)
  );
}

function isAccountName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= 2 &&
    value.trim().length <= 120
  );
}

function isAccountNumber(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{6,20}$/.test(value)
  );
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
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const paystackSecretKey =
    Deno.env.get("PAYSTACK_SECRET_KEY");

  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceRoleKey ||
    !paystackSecretKey
  ) {
    console.error(
      "mentor-payment-settings is missing required environment variables.",
    );

    return jsonResponse(
      {
        ok: false,
        error: "server_not_configured",
      },
      500,
    );
  }

  const authHeader =
    req.headers.get("authorization") ?? "";

  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse(
      {
        ok: false,
        error: "unauthorized",
      },
      401,
    );
  }

  const accessToken = authHeader.slice(7).trim();

  const userClient = createClient(
    supabaseUrl,
    anonKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const {
    data: userData,
    error: userError,
  } = await userClient.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return jsonResponse(
      {
        ok: false,
        error: "unauthorized",
      },
      401,
    );
  }

  let payload: RequestPayload;

  try {
    payload = (await req.json()) as RequestPayload;
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: "invalid_json",
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

  if (payload.action === "list_banks") {
    let paystackResponse: Response;

    try {
      paystackResponse = await fetch(
        "https://api.paystack.co/bank?country=south%20africa&currency=ZAR&perPage=100",
        {
          headers: {
            Authorization:
              `Bearer ${paystackSecretKey}`,
          },
        },
      );
    } catch {
      return jsonResponse(
        {
          ok: false,
          error: "paystack_unreachable",
        },
        502,
      );
    }

    let paystackPayload: PaystackListBanksResponse;

    try {
      paystackPayload =
        (await paystackResponse.json()) as PaystackListBanksResponse;
    } catch {
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
      paystackPayload.status !== true ||
      !Array.isArray(paystackPayload.data)
    ) {
      return jsonResponse(
        {
          ok: false,
          error: "bank_list_failed",
        },
        502,
      );
    }

    const banks = paystackPayload.data
      .filter(
        (bank) =>
          typeof bank.name === "string" &&
          typeof bank.code === "string" &&
          bank.active !== false,
      )
      .map((bank) => ({
        name: bank.name as string,
        code: bank.code as string,
      }))
      .sort((left, right) =>
        left.name.localeCompare(right.name)
      );

    return jsonResponse({
      ok: true,
      state: "banks_ready",
      banks,
    });
  }

  if (payload.action !== "configure_account") {
    return jsonResponse(
      {
        ok: false,
        error: "unsupported_action",
      },
      400,
    );
  }

  if (
    !isBankCode(payload.bankCode) ||
    !isAccountName(payload.accountName) ||
    !isAccountNumber(payload.accountNumber)
  ) {
    return jsonResponse(
      {
        ok: false,
        error: "invalid_bank_details",
      },
      400,
    );
  }

  const {
    data: mentorProfile,
    error: mentorProfileError,
  } = await adminClient
    .from("mentor_profiles")
    .select("mentor_id")
    .eq("mentor_id", userData.user.id)
    .maybeSingle();

  if (mentorProfileError) {
    console.error(
      "Unable to check mentor profile for payout configuration.",
      {
        userId: userData.user.id,
      },
    );

    return jsonResponse(
      {
        ok: false,
        error: "mentor_profile_lookup_failed",
      },
      500,
    );
  }

  if (!mentorProfile) {
    return jsonResponse(
      {
        ok: false,
        error: "mentor_profile_required",
      },
      409,
    );
  }

  const {
    data: paymentPolicy,
    error: policyError,
  } = await adminClient
    .from("mentorship_payment_policies")
    .select("platform_fee_bps")
    .eq("is_active", true)
    .order("effective_from", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (
    policyError ||
    !paymentPolicy ||
    typeof paymentPolicy.platform_fee_bps !== "number"
  ) {
    console.error(
      "Unable to resolve active mentorship payment policy.",
    );

    return jsonResponse(
      {
        ok: false,
        error: "payment_policy_unavailable",
      },
      500,
    );
  }

  const {
    data: existingAccount,
    error: accountLookupError,
  } = await adminClient
    .from("mentor_payment_accounts")
    .select("provider_account_code")
    .eq("mentor_id", userData.user.id)
    .maybeSingle();

  if (accountLookupError) {
    console.error(
      "Unable to resolve mentor payment account.",
      {
        userId: userData.user.id,
      },
    );

    return jsonResponse(
      {
        ok: false,
        error: "payment_account_lookup_failed",
      },
      500,
    );
  }

  const percentageCharge =
    paymentPolicy.platform_fee_bps / 100;

  const accountName = payload.accountName.trim();
  const bankCode = payload.bankCode.trim();
  const accountNumber = payload.accountNumber.trim();

  const endpoint = existingAccount
    ? `https://api.paystack.co/subaccount/${encodeURIComponent(
        existingAccount.provider_account_code,
      )}`
    : "https://api.paystack.co/subaccount";

  const providerBody = existingAccount
    ? {
        business_name: accountName,
        bank_code: bankCode,
        account_number: accountNumber,
        percentage_charge: percentageCharge,
        active: true,
      }
    : {
        business_name: accountName,
        settlement_bank: bankCode,
        account_number: accountNumber,
        percentage_charge: percentageCharge,
      };

  let providerResponse: Response;

  try {
    providerResponse = await fetch(endpoint, {
      method: existingAccount ? "PUT" : "POST",
      headers: {
        Authorization:
          `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(providerBody),
    });
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: "paystack_unreachable",
      },
      502,
    );
  }

  let providerPayload: PaystackSubaccountResponse;

  try {
    providerPayload =
      (await providerResponse.json()) as PaystackSubaccountResponse;
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: "invalid_paystack_response",
      },
      502,
    );
  }

  const providerAccountCode =
    providerPayload.data?.subaccount_code;

  if (
    !providerResponse.ok ||
    providerPayload.status !== true ||
    typeof providerAccountCode !== "string" ||
    !providerAccountCode.startsWith("ACCT_")
  ) {
    console.error(
      "Paystack rejected mentor payout account configuration.",
      {
        status: providerResponse.status,
        userId: userData.user.id,
      },
    );

    return jsonResponse(
      {
        ok: false,
        error: "payout_account_configuration_failed",
      },
      502,
    );
  }

  const {
    error: saveError,
  } = await adminClient
    .from("mentor_payment_accounts")
    .upsert(
      {
        mentor_id: userData.user.id,
        provider: "paystack",
        provider_account_code: providerAccountCode,
        status: "active",
        display_name: null,
        settlement_bank_name: null,
        account_last4: null,
        can_receive_payments: true,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "mentor_id",
      },
    );

  if (saveError) {
    console.error(
      "Unable to save mentor payout provider reference.",
      {
        userId: userData.user.id,
      },
    );

    return jsonResponse(
      {
        ok: false,
        error: "payment_account_save_failed",
      },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    state: "ready",
  });
});
