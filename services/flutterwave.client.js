// Shared Flutterwave HTTP client.
//
// All Flutterwave v3 REST calls go through `flwRequest()`. The wrapper
// centralises the base URL, authentication header (`Bearer <secret key>`),
// and error shaping so the controllers and the other Flutterwave service
// modules stay small and consistent.
//
// Env vars expected (set in backend-ematony/.env):
//   FLW_SECRET_KEY      — required for any v3 call
//   FLW_PUBLIC_KEY      — surfaced to clients only where needed (none yet)
//   FLW_ENCRYPTION_KEY  — required only for the encrypted-payload endpoints
//                         we currently do not use (kept for future card flows)
//   FLW_BASE_URL        — optional override for staging / mock

const DEFAULT_BASE_URL = "https://api.flutterwave.com/v3";

export const getFlutterwaveConfig = () => ({
  baseUrl: (process.env.FLW_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
  secretKey: process.env.FLW_SECRET_KEY || "",
  publicKey: process.env.FLW_PUBLIC_KEY || "",
  encryptionKey: process.env.FLW_ENCRYPTION_KEY || "",
});

if (!process.env.FLW_SECRET_KEY) {
  console.warn(
    "FLW_SECRET_KEY is not set — Flutterwave calls will fail until you add it to .env."
  );
}

/**
 * Performs a Flutterwave v3 REST call and returns the parsed JSON `data`
 * field. Throws an Error with the Flutterwave-supplied message on any
 * non-2xx response or on `status !== "success"`.
 */
export const flwRequest = async (
  path,
  { method = "GET", body, query } = {}
) => {
  const { baseUrl, secretKey } = getFlutterwaveConfig();
  if (!secretKey) {
    throw new Error("FLW_SECRET_KEY is not configured");
  }

  let url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      params.append(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch (_err) {
    // Non-JSON response — fall through to error branch below.
  }

  if (!res.ok || (payload && payload.status && payload.status !== "success")) {
    const message =
      (payload && (payload.message || payload.data?.message)) ||
      `Flutterwave request failed (${res.status})`;
    const err = new Error(message);
    err.statusCode = res.status;
    err.flwResponse = payload;
    throw err;
  }

  return payload?.data ?? payload ?? {};
};

/**
 * Builds an idempotent transaction reference. Flutterwave requires a unique
 * `tx_ref` per payment attempt; we tag it with the user id and a short
 * timestamp so we can correlate it back in logs.
 */
export const buildTxRef = (prefix, userId) => {
  const suffix = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  return `${prefix}-${String(userId).slice(-6)}-${suffix}`;
};
