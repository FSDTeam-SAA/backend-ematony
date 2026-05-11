import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.warn("STRIPE_SECRET_KEY is not set — Stripe payments will fail.");
}

export const stripe = new Stripe(stripeSecretKey || "");

const DEFAULT_CURRENCY = (process.env.STRIPE_CURRENCY || "usd").toLowerCase();

/**
 * Ensures the User has a Stripe Customer record. Stores the id on the user
 * document on first creation so subsequent payments reuse the same customer.
 */
export const ensureStripeCustomer = async (user) => {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email || undefined,
    name: user.name || undefined,
    phone: user.phone || undefined,
    metadata: { userId: String(user._id) },
  });

  user.stripeCustomerId = customer.id;
  await user.save();
  return customer.id;
};

/**
 * Creates everything PaymentSheet needs: a Customer, a single-use Ephemeral
 * Key (so the mobile app can talk to Stripe directly without leaking the
 * secret key), and a PaymentIntent.
 */
export const createTopupPaymentSheet = async ({ user, amount, currency }) => {
  const customerId = await ensureStripeCustomer(user);

  const apiVersion = "2024-06-20";
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion }
  );

  const usedCurrency = (currency || DEFAULT_CURRENCY).toLowerCase();

  // Stripe expects the smallest currency unit (e.g. cents for USD).
  const amountMinorUnits = Math.round(Number(amount) * 100);
  if (!Number.isFinite(amountMinorUnits) || amountMinorUnits <= 0) {
    throw new Error("Invalid amount");
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountMinorUnits,
    currency: usedCurrency,
    customer: customerId,
    automatic_payment_methods: { enabled: true },
    metadata: {
      userId: String(user._id),
      purpose: "wallet_topup",
    },
  });

  return {
    paymentIntent: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    ephemeralKey: ephemeralKey.secret,
    customer: customerId,
    amount: Number(amount),
    currency: usedCurrency,
  };
};

export const retrievePaymentIntent = (id) => stripe.paymentIntents.retrieve(id);
