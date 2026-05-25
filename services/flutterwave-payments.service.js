import { buildTxRef, flwRequest } from "./flutterwave.client.js";

const DEFAULT_CURRENCY = (process.env.FLW_DEFAULT_CURRENCY || "NGN").toUpperCase();

/**
 * Returns the publicly reachable URL the user is redirected to after
 * paying on Flutterwave's hosted checkout. We host a small "you can return
 * to the app" page on the backend (see server.js → /payments/return).
 */
const buildRedirectUrl = () => {
  const base = (
    process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`
  ).replace(/\/$/, "");
  return `${base}/payments/return`;
};

/**
 * Creates a hosted Flutterwave checkout link for wallet top-ups.
 *
 * Returns:
 *   { paymentLink, txRef, amount, currency }
 *
 * The mobile app opens `paymentLink` in an external browser. On
 * completion Flutterwave redirects the browser to our /payments/return
 * page (which bounces back into the app via deep link). The app then
 * calls /payment/me/topup/confirm with the txRef so the backend can
 * verify with Flutterwave and credit the wallet.
 */
export const createTopupPaymentLink = async ({ user, amount, currency }) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Invalid amount");
  }

  const usedCurrency = (currency || DEFAULT_CURRENCY).toUpperCase();
  const txRef = buildTxRef("topup", user._id);

  const data = await flwRequest("/payments", {
    method: "POST",
    body: {
      tx_ref: txRef,
      amount: value,
      currency: usedCurrency,
      redirect_url: buildRedirectUrl(),
      customer: {
        email: user.email || `user-${user._id}@ematony.app`,
        phonenumber: user.phone || undefined,
        name: user.name || undefined,
      },
      customizations: {
        title: "Ajo Family Wallet",
        description: "Top up your Ajo Family wallet",
      },
      meta: {
        userId: String(user._id),
        purpose: "wallet_topup",
      },
    },
  });

  return {
    paymentLink: data?.link || "",
    txRef,
    amount: value,
    currency: usedCurrency,
  };
};

/**
 * Verifies a Flutterwave transaction by `tx_ref`. Flutterwave returns the
 * full transaction object including its status. We expect "successful" for
 * a paid top-up.
 */
export const verifyTransactionByTxRef = async (txRef) => {
  if (!txRef) throw new Error("txRef is required");
  return flwRequest(`/transactions/verify_by_reference`, {
    query: { tx_ref: txRef },
  });
};

/**
 * Verifies a transaction by its Flutterwave-assigned numeric id. Used as a
 * fallback when the client returns from checkout with `transaction_id` but
 * no tx_ref (rare).
 */
export const verifyTransactionById = async (transactionId) => {
  if (!transactionId) throw new Error("transactionId is required");
  return flwRequest(`/transactions/${transactionId}/verify`);
};
