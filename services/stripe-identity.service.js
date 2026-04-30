import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const getStripeClient = () => {
  if (!stripe) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  return stripe;
};

const getIdentityReturnUrl = () =>
  process.env.STRIPE_IDENTITY_RETURN_URL ||
  process.env.CLIENT_URL ||
  process.env.ADMIN_APP_URL ||
  "http://localhost:3000";

export const createIdentityVerificationSession = async ({ user }) => {
  return getStripeClient().identity.verificationSessions.create({
    type: "document",
    return_url: getIdentityReturnUrl(),
    provided_details: {
      email: user.email,
      ...(user.phone ? { phone: user.phone } : {}),
    },
    metadata: {
      userId: String(user._id),
    },
    options: {
      document: {
        require_matching_selfie: true,
      },
    },
  });
};

export const retrieveIdentityVerificationSession = async (sessionId) => {
  return getStripeClient().identity.verificationSessions.retrieve(sessionId);
};
