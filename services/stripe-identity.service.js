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

const getIdentityReturnUrl = () => {
  // Prefer the API-hosted return page so we control the bounce-into-app
  // flow with a deep link. Fall back to legacy envs.
  if (process.env.STRIPE_IDENTITY_RETURN_URL) {
    return process.env.STRIPE_IDENTITY_RETURN_URL;
  }
  if (process.env.API_PUBLIC_URL) {
    return `${process.env.API_PUBLIC_URL.replace(/\/$/, "")}/api/v1/kyc/stripe/return`;
  }
  return (
    process.env.CLIENT_URL ||
    process.env.ADMIN_APP_URL ||
    "http://localhost:5000/api/v1/kyc/stripe/return"
  );
};

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
