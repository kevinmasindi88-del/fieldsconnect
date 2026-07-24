export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    const message = (error as { message: string }).message.trim();

    if (message) {
      return message;
    }
  }

  return fallback;
}

export function isSuspensionMessage(message: string | null): boolean {
  if (!message) return false;

  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("account suspended") ||
    normalizedMessage.includes("account is currently suspended") ||
    normalizedMessage.includes("platform activity is unavailable")
  );
}

export function getActionErrorMessage(
  error: unknown,
  actionDescription: string
): string {
  const rawMessage = getErrorMessage(
    error,
    `Unable to ${actionDescription}.`
  );

  if (isSuspensionMessage(rawMessage)) {
    return `Unable to ${actionDescription} — account suspended. Platform activity is unavailable until the suspension ends.`;
  }

  return rawMessage;
}

export function getMessageAlertClass(message: string | null): string {
  return isSuspensionMessage(message)
    ? "rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-700"
    : "rounded-lg border p-3 text-sm text-gray-700";
}