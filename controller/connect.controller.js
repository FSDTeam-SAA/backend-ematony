import httpStatus from "http-status";
import AppError from "../errors/AppError.js";
import { User } from "../model/user.model.js";
import {
  listBanks,
  resolveBankAccount,
} from "../services/flutterwave-transfers.service.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";

/** GET /payouts/banks?country=NG — list banks for the dropdown. */
export const getBanks = catchAsync(async (req, res) => {
  const country = (req.query.country || "NG").toString().toUpperCase();
  const banks = await listBanks(country);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Banks fetched",
    data: banks,
  });
});

/**
 * POST /payouts/resolve — verifies that an account number + bank code
 * resolves to a real account, returning the registered name. The mobile
 * app uses this to show "Account holder: …" before submitting.
 */
export const resolveAccount = catchAsync(async (req, res) => {
  const { accountNumber, bankCode } = req.body;
  if (!accountNumber || !bankCode) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "accountNumber and bankCode are required"
    );
  }

  const result = await resolveBankAccount({
    accountNumber,
    accountBank: bankCode,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Account resolved",
    data: {
      accountNumber: result.account_number,
      accountName: result.account_name,
      bankCode,
    },
  });
});

/**
 * POST /payouts/bank — saves the user's resolved bank account so future
 * withdrawals can run without re-asking. We re-resolve server-side as a
 * defence in case the client posted stale or tampered values.
 */
export const saveBankAccount = catchAsync(async (req, res) => {
  const { accountNumber, bankCode, bankName, currency } = req.body;
  if (!accountNumber || !bankCode) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "accountNumber and bankCode are required"
    );
  }

  const user = await User.findById(req.user._id);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const resolved = await resolveBankAccount({
    accountNumber,
    accountBank: bankCode,
  });

  user.bankAccount = {
    number: resolved.account_number || accountNumber,
    bankCode,
    bankName: bankName || "",
    accountName: resolved.account_name || "",
    currency: (currency || "NGN").toUpperCase(),
  };
  user.payoutsEnabled = true;
  await user.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Bank account saved",
    data: {
      bankAccount: user.bankAccount,
      payoutsEnabled: user.payoutsEnabled,
    },
  });
});

/**
 * GET /payouts/status — same shape as the old Stripe Connect status so the
 * mobile app's wallet flow can read it without changes.
 */
export const getPayoutStatus = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const hasBank = Boolean(user.bankAccount?.number && user.bankAccount?.bankCode);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payout status fetched",
    data: {
      connected: hasBank,
      payoutsEnabled: hasBank && Boolean(user.payoutsEnabled),
      detailsSubmitted: hasBank,
      bankAccount: hasBank
        ? {
            bankCode: user.bankAccount.bankCode,
            bankName: user.bankAccount.bankName,
            accountName: user.bankAccount.accountName,
            number: user.bankAccount.number,
            currency: user.bankAccount.currency,
          }
        : null,
    },
  });
});
