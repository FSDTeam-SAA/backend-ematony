import { buildTxRef, flwRequest } from "./flutterwave.client.js";

const DEFAULT_CURRENCY = (process.env.FLW_DEFAULT_CURRENCY || "NGN").toUpperCase();
const DEFAULT_COUNTRY = (process.env.FLW_DEFAULT_COUNTRY || "NG").toUpperCase();

/**
 * Lists banks for a given country (ISO-2). Used by the mobile app to
 * populate the "select your bank" dropdown during payout setup.
 *
 * Flutterwave returns `[{ id, code, name }, ...]`.
 */
export const listBanks = async (country) => {
  const c = (country || DEFAULT_COUNTRY).toUpperCase();
  return flwRequest(`/banks/${c}`);
};

/**
 * Resolves a bank account number against a bank code, returning the
 * registered account holder name. This is how Flutterwave confirms the
 * account is real before we attempt a transfer. We persist the result on
 * the user so payouts can run later without another lookup.
 */
export const resolveBankAccount = async ({ accountNumber, accountBank }) => {
  if (!accountNumber || !accountBank) {
    throw new Error("Account number and bank code are required");
  }
  return flwRequest("/accounts/resolve", {
    method: "POST",
    body: {
      account_number: String(accountNumber).trim(),
      account_bank: String(accountBank).trim(),
    },
  });
};

/**
 * Initiates a payout to the user's saved bank account. Flutterwave returns
 * a transfer object whose `status` is initially "NEW" or "PENDING"; the
 * actual settlement happens asynchronously.
 */
export const createTransfer = async ({ user, amount, currency, withdrawalId, narration }) => {
  if (!user.bankAccount?.number || !user.bankAccount?.bankCode) {
    throw new Error("User has not added bank account details");
  }

  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Invalid amount");
  }

  const usedCurrency = (currency || DEFAULT_CURRENCY).toUpperCase();
  const reference = buildTxRef("payout", user._id);

  const transfer = await flwRequest("/transfers", {
    method: "POST",
    body: {
      account_bank: user.bankAccount.bankCode,
      account_number: user.bankAccount.number,
      amount: value,
      currency: usedCurrency,
      debit_currency: usedCurrency,
      narration: narration || `Ajo Family withdrawal`,
      reference,
      meta: {
        userId: String(user._id),
        withdrawalId: withdrawalId ? String(withdrawalId) : "",
        purpose: "wallet_withdrawal",
      },
    },
  });

  return { transfer, reference };
};
