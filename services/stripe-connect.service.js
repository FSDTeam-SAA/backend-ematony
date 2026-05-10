import { stripe } from "./stripe-payments.service.js";

const DEFAULT_COUNTRY = (process.env.STRIPE_CONNECT_COUNTRY || "US").toUpperCase();
const DEFAULT_CURRENCY = (process.env.STRIPE_CURRENCY || "usd").toLowerCase();

/**
 * Builds the absolute URL for the on-platform return/refresh pages used by
 * Stripe-hosted onboarding. Stripe redirects the browser back to these
 * URLs after the user finishes (or abandons) onboarding.
 *
 * APP_BASE_URL should be the publicly reachable URL of this backend
 * (e.g. an ngrok tunnel during local development). Falls back to
 * localhost so things at least don't crash in dev.
 */
const baseUrl = () =>
  (process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, "");

/**
 * Ensures the User has a Stripe Connect Express account. Stores the id and
 * keeps `payoutsEnabled` in sync with whatever Stripe currently reports.
 */
export const ensureConnectAccount = async (user) => {
  if (user.stripeConnectAccountId) {
    return user.stripeConnectAccountId;
  }

  const account = await stripe.accounts.create({
    type: "express",
    country: DEFAULT_COUNTRY,
    email: user.email || undefined,
    capabilities: {
      transfers: { requested: true },
    },
    business_type: "individual",
    metadata: { userId: String(user._id) },
  });

  user.stripeConnectAccountId = account.id;
  await user.save();
  return account.id;
};

/**
 * Creates a single-use Stripe-hosted onboarding URL. The user opens this in
 * a browser, fills in their bank/identity details, and is redirected back
 * to one of our return/refresh pages.
 */
export const createOnboardingLink = async (user) => {
  const accountId = await ensureConnectAccount(user);

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl()}/connect/refresh?userId=${user._id}`,
    return_url: `${baseUrl()}/connect/return?userId=${user._id}`,
    type: "account_onboarding",
  });

  return {
    url: accountLink.url,
    expiresAt: accountLink.expires_at,
    accountId,
  };
};

/**
 * Fetches the latest Connect account status from Stripe and persists the
 * `payoutsEnabled` flag on the user document so the app can read it
 * cheaply on subsequent calls.
 */
export const refreshConnectStatus = async (user) => {
  if (!user.stripeConnectAccountId) {
    return {
      connected: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      requirements: null,
    };
  }

  const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);

  const payoutsEnabled = Boolean(account.payouts_enabled);
  if (user.payoutsEnabled !== payoutsEnabled) {
    user.payoutsEnabled = payoutsEnabled;
    await user.save();
  }

  return {
    connected: true,
    payoutsEnabled,
    detailsSubmitted: Boolean(account.details_submitted),
    requirements: account.requirements || null,
    accountId: account.id,
  };
};

/**
 * Pays out to the user's connected Express account.
 *
 * In test mode the platform's Stripe balance is funded via test charges, so
 * Transfer succeeds. The connected account's automatic payouts schedule
 * (set during onboarding) will subsequently move the funds to the user's
 * bank.
 */
export const payoutToConnectedAccount = async ({ user, amount, currency, withdrawalId }) => {
  if (!user.stripeConnectAccountId) {
    throw new Error("User has not completed Stripe onboarding");
  }
  if (!user.payoutsEnabled) {
    throw new Error("Stripe onboarding incomplete — payouts not enabled yet");
  }

  const usedCurrency = (currency || DEFAULT_CURRENCY).toLowerCase();
  const amountMinorUnits = Math.round(Number(amount) * 100);
  if (!Number.isFinite(amountMinorUnits) || amountMinorUnits <= 0) {
    throw new Error("Invalid amount");
  }

  const transfer = await stripe.transfers.create({
    amount: amountMinorUnits,
    currency: usedCurrency,
    destination: user.stripeConnectAccountId,
    metadata: {
      userId: String(user._id),
      withdrawalId: withdrawalId ? String(withdrawalId) : "",
      purpose: "wallet_withdrawal",
    },
  });

  return transfer;
};
