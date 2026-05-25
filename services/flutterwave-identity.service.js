import { flwRequest } from "./flutterwave.client.js";

/**
 * Resolves a Bank Verification Number (BVN). Flutterwave's KYC product
 * returns the registered name, date of birth, gender, and phone. We use
 * this to confirm the user's identity matches what they entered manually
 * in the KYC flow.
 *
 * Endpoint: POST /v3/kyc/bvns  body: { bvn }
 * Returns:  { bvn, first_name, last_name, date_of_birth, gender, phone_number, ... }
 *
 * Some Flutterwave accounts require the KYC add-on to be enabled before
 * this endpoint returns data. If the call fails we surface the error to
 * the controller, which records it on the KYC record and asks the user
 * to resubmit.
 */
export const resolveBvn = async (bvn) => {
  const cleaned = String(bvn || "").trim();
  if (!/^\d{11}$/.test(cleaned)) {
    throw new Error("BVN must be 11 digits");
  }
  return flwRequest("/kyc/bvns", {
    method: "POST",
    body: { bvn: cleaned },
  });
};

/**
 * Resolves a National Identification Number (NIN). Same shape as the BVN
 * endpoint but uses a different ID registry.
 */
export const resolveNin = async (nin) => {
  const cleaned = String(nin || "").trim();
  if (!/^\d{11}$/.test(cleaned)) {
    throw new Error("NIN must be 11 digits");
  }
  return flwRequest("/kyc/nins", {
    method: "POST",
    body: { nin: cleaned },
  });
};

/**
 * Normalises a resolved BVN/NIN payload into the subset of fields we
 * persist on the KYC record.
 */
export const summariseIdentity = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  return {
    firstName: raw.first_name || "",
    lastName: raw.last_name || "",
    dateOfBirth: raw.date_of_birth || "",
    gender: raw.gender || "",
    phoneNumber: raw.phone_number || "",
  };
};
