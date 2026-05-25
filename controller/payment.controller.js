import httpStatus from "http-status";
import mongoose from "mongoose";
import AppError from "../errors/AppError.js";
import { GroupMembership } from "../model/groupMembership.model.js";
import { SavingsGroup } from "../model/group.model.js";
import { Payment } from "../model/payment.model.js";
import { Withdrawal } from "../model/withdrawal.model.js";
import catchAsync from "../utils/catchAsync.js";
import { buildMeta, parsePagination } from "../utils/pagination.js";
import sendResponse from "../utils/sendResponse.js";
import {
  createNotification,
  NotificationTemplates,
} from "../services/notification.service.js";
import {
  createTopupPaymentLink,
  verifyTransactionById,
  verifyTransactionByTxRef,
} from "../services/flutterwave-payments.service.js";
import { createTransfer } from "../services/flutterwave-transfers.service.js";
import { User } from "../model/user.model.js";
import {
  calculateLateFee,
  getContributionPeriod,
  normalizeGroupFrequency,
  roundMoney,
} from "../utils/groupPolicy.js";

export const getPayments = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const paymentStatus = req.query.status?.toString().trim();
  const type = req.query.type?.toString().trim();
  const userId = req.query.userId?.toString().trim();
  const groupId = req.query.groupId?.toString().trim();

  const query = {
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(type ? { type } : {}),
    ...(userId && mongoose.Types.ObjectId.isValid(userId) ? { userId } : {}),
    ...(groupId && mongoose.Types.ObjectId.isValid(groupId) ? { groupId } : {}),
  };

  const [data, total] = await Promise.all([
    Payment.find(query)
      .populate("userId", "name firstName lastName email phone role avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(query),
  ]);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payments fetched successfully",
    data,
    meta: buildMeta(page, limit, total),
  });
});

export const getPaymentById = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid payment id");
  }

  const payment = await Payment.findById(id).populate(
    "userId",
    "name firstName lastName email phone role avatar"
  );

  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment fetched successfully",
    data: payment,
  });
});

export const getMyPayments = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const paymentStatus = req.query.status?.toString().trim();
  const type = req.query.type?.toString().trim();

  const query = {
    userId: req.user._id,
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(type ? { type } : {}),
  };

  const [data, total] = await Promise.all([
    Payment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(query),
  ]);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your payments fetched successfully",
    data,
    meta: buildMeta(page, limit, total),
  });
});

export const recordMonthlyContribution = catchAsync(async (req, res) => {
  const { groupId, paymentMethod, transactionId } = req.body;

  if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Valid groupId is required");
  }
  if (req.kycStatus !== "approved" && req.user.role !== "admin") {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "KYC verification is required to make payments"
    );
  }

  const membership = await GroupMembership.findOne({
    groupId,
    userId: req.user._id,
    status: "active",
  });
  if (!membership) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not a member of this group");
  }

  const group = await SavingsGroup.findById(groupId);
  if (!group) {
    throw new AppError(httpStatus.NOT_FOUND, "Group not found");
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const period = getContributionPeriod(group, now);

  const existing = await Payment.findOne({
    userId: req.user._id,
    groupId,
    type: "group_contribution",
    paymentStatus: { $in: ["complete", "succeeded"] },
    periodStart: period.periodStart,
  });
  if (existing) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You have already paid this contribution period"
    );
  }

  const isLate = now > period.dueDate;
  const isPastGrace = now > period.graceDeadline;
  const lateFeeAmount = isPastGrace ? calculateLateFee(group.contributionAmount) : 0;
  const totalAmount = roundMoney(group.contributionAmount + lateFeeAmount);
  const eligibleForWheel = now <= period.graceDeadline;

  const payment = await Payment.create({
    userId: req.user._id,
    groupId,
    price: totalAmount,
    baseAmount: group.contributionAmount,
    lateFeeApplied: lateFeeAmount > 0,
    lateFeeAmount,
    adminCreditAmount: lateFeeAmount,
    currencyCode: group.currencyCode,
    dueDate: period.dueDate,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    paymentStatus: "complete",
    type: "group_contribution",
    paymentMethod: paymentMethod || "manual",
    transactionId: transactionId || "",
    referenceCode: `CONTRIB-${year}${String(month).padStart(2, "0")}-${String(
      req.user._id
    ).slice(-6)}`,
    notes: lateFeeAmount > 0 ? "Late fee credited to group admin" : "",
  });

  if (lateFeeAmount > 0) {
    await Payment.create({
      userId: group.ownerUserId,
      groupId,
      price: lateFeeAmount,
      baseAmount: 0,
      lateFeeApplied: true,
      lateFeeAmount,
      adminCreditAmount: lateFeeAmount,
      currencyCode: group.currencyCode,
      dueDate: period.dueDate,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      paymentStatus: "complete",
      type: "late_fee_admin_credit",
      paymentMethod: paymentMethod || "manual",
      transactionId: transactionId || "",
      referenceCode: `LATE-${year}${String(month).padStart(2, "0")}-${String(
        req.user._id
      ).slice(-6)}`,
      notes: "7.5% late fee credited to group admin",
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: lateFeeAmount > 0
      ? "Contribution recorded with a 7.5% late fee credited to the group admin."
      : isLate
        ? "Contribution recorded during the 24-hour grace period."
        : "Contribution recorded successfully.",
    data: {
      payment,
      eligibleForWheel,
      month,
      year,
      frequency: normalizeGroupFrequency(group.contributionFrequency),
      dueDate: period.dueDate,
      graceDeadline: period.graceDeadline,
      lateFeeAmount,
    },
  });
});

export const getMyWalletBalance = catchAsync(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user._id);

  const credits = await Payment.aggregate([
    {
      $match: {
        userId,
        type: { $in: ["payout", "wallet_topup"] },
        paymentStatus: { $in: ["complete", "succeeded"] },
      },
    },
    { $group: { _id: null, total: { $sum: "$price" } } },
  ]);

  const withdrawals = await Withdrawal.aggregate([
    {
      $match: {
        userId,
        status: { $in: ["pending", "approved", "paid"] },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const totalEarned = credits[0]?.total || 0;
  const totalWithdrawn = withdrawals[0]?.total || 0;
  const available = Math.max(0, totalEarned - totalWithdrawn);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Wallet balance fetched successfully",
    data: { available, totalEarned, totalWithdrawn },
  });
});

export const requestWithdrawal = catchAsync(async (req, res) => {
  const { amount, method, accountDetails, note, currency } = req.body;
  const value = Number(amount);

  if (!value || value <= 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "Valid amount is required");
  }
  if (req.kycStatus !== "approved" && req.user.role !== "admin") {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "KYC verification is required to withdraw"
    );
  }

  const userId = new mongoose.Types.ObjectId(req.user._id);
  const [credits, withdrawals] = await Promise.all([
    Payment.aggregate([
      {
        $match: {
          userId,
          type: { $in: ["payout", "wallet_topup"] },
          paymentStatus: { $in: ["complete", "succeeded"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]),
    Withdrawal.aggregate([
      {
        $match: {
          userId,
          status: { $in: ["pending", "approved", "paid"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);
  const available =
    (credits[0]?.total || 0) - (withdrawals[0]?.total || 0);

  if (value > available) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Insufficient balance. Available: ${available}`
    );
  }

  // Require a saved + resolved Flutterwave bank account before paying out.
  const user = await User.findById(req.user._id);
  if (!user?.bankAccount?.number || !user?.bankAccount?.bankCode) {
    throw new AppError(
      httpStatus.PRECONDITION_REQUIRED,
      "Add your bank account before withdrawing"
    );
  }
  if (!user.payoutsEnabled) {
    throw new AppError(
      httpStatus.PRECONDITION_REQUIRED,
      "Bank account is not verified yet"
    );
  }

  const withdrawal = await Withdrawal.create({
    userId: req.user._id,
    amount: value,
    method: method || "flutterwave_transfer",
    accountDetails:
      accountDetails ||
      `${user.bankAccount.bankName || ""} • ${user.bankAccount.number}`,
    note: note || "",
    status: "pending",
  });

  // Attempt the Flutterwave transfer. Failures leave the row as pending so
  // admin can investigate and retry/refund manually.
  try {
    const { transfer, reference } = await createTransfer({
      user,
      amount: value,
      currency,
      withdrawalId: withdrawal._id,
    });

    // Flutterwave transfers settle asynchronously, so we mark the row as
    // "paid" only when the immediate response shows SUCCESSFUL; otherwise
    // we leave it pending and rely on admin/cron to reconcile later.
    const status = (transfer?.status || "").toUpperCase();
    if (status === "SUCCESSFUL") {
      withdrawal.status = "paid";
      withdrawal.processedAt = new Date();
    }
    withdrawal.note = withdrawal.note
      ? `${withdrawal.note} | flw_ref: ${reference}`
      : `flw_ref: ${reference}`;
    await withdrawal.save();
  } catch (err) {
    console.error("Flutterwave transfer failed:", err?.message || err);
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      err?.message || "Flutterwave transfer failed"
    );
  }

  try {
    const tpl = NotificationTemplates.withdrawalRequested({ amount: value });
    await createNotification({
      userId: req.user._id,
      amount: value,
      metadata: { withdrawalId: withdrawal._id, status: withdrawal.status },
      ...tpl,
    });
  } catch (err) {
    console.error("Withdrawal notification failed:", err?.message || err);
  }

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Withdrawal processed successfully",
    data: withdrawal,
  });
});

export const updateWithdrawalStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid withdrawal id");
  }
  if (!["approved", "paid", "rejected", "cancelled"].includes(status)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid status");
  }

  const withdrawal = await Withdrawal.findById(id);
  if (!withdrawal) {
    throw new AppError(httpStatus.NOT_FOUND, "Withdrawal not found");
  }

  withdrawal.status = status;
  withdrawal.processedAt = new Date();
  withdrawal.processedBy = req.user._id;
  if (status === "rejected" && reason) {
    withdrawal.rejectionReason = reason;
  }
  await withdrawal.save();

  try {
    if (status === "approved" || status === "paid") {
      const tpl = NotificationTemplates.withdrawalApproved({
        amount: withdrawal.amount,
      });
      await createNotification({
        userId: withdrawal.userId,
        amount: withdrawal.amount,
        metadata: { withdrawalId: withdrawal._id, status },
        ...tpl,
      });
    } else if (status === "rejected") {
      const tpl = NotificationTemplates.withdrawalRejected({
        amount: withdrawal.amount,
        reason,
      });
      await createNotification({
        userId: withdrawal.userId,
        amount: withdrawal.amount,
        metadata: { withdrawalId: withdrawal._id, status, reason },
        ...tpl,
      });
    }
  } catch (err) {
    console.error("Withdrawal status notification failed:", err?.message || err);
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Withdrawal status updated",
    data: withdrawal,
  });
});

// ─── Flutterwave Top-Up ──────────────────────────────────────────────────────
// Two-step flow:
//   1) POST /me/topup/sheet  → backend asks Flutterwave for a hosted-checkout
//      link and returns `{ paymentLink, txRef, ... }`.
//   2) Mobile app opens the link in an external browser; user pays.
//   3) POST /me/topup/confirm with `{ txRef }` (or transactionId) → backend
//      verifies via Flutterwave's /transactions/verify endpoint and creates a
//      Payment row crediting the wallet. Idempotent — re-calling won't
//      double-credit.

export const createTopupSheet = catchAsync(async (req, res) => {
  const { amount, currency } = req.body;
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "Valid amount is required");
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const link = await createTopupPaymentLink({
    user,
    amount: value,
    currency,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Top-up payment link created",
    data: link,
  });
});

export const confirmTopup = catchAsync(async (req, res) => {
  const { txRef, transactionId } = req.body;
  if ((!txRef || typeof txRef !== "string") && !transactionId) {
    throw new AppError(httpStatus.BAD_REQUEST, "txRef or transactionId is required");
  }

  // Idempotency: if we already credited this tx_ref or Flutterwave
  // transaction id, return that record without re-charging.
  const idempotencyKey = txRef || String(transactionId);
  const existing = await Payment.findOne({
    userId: req.user._id,
    transactionId: idempotencyKey,
    type: "wallet_topup",
  });
  if (existing) {
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Top-up already recorded",
      data: existing,
    });
  }

  // Ask Flutterwave for the authoritative transaction state.
  const tx = txRef
    ? await verifyTransactionByTxRef(txRef)
    : await verifyTransactionById(transactionId);

  if (!tx) {
    throw new AppError(httpStatus.NOT_FOUND, "Transaction not found");
  }
  if (String(tx.meta?.userId) !== String(req.user._id)) {
    throw new AppError(httpStatus.FORBIDDEN, "Transaction does not belong to you");
  }
  const txStatus = (tx.status || "").toLowerCase();
  if (txStatus !== "successful") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Payment not successful (status: ${tx.status || "unknown"})`
    );
  }

  const value = Number(tx.amount_settled ?? tx.charged_amount ?? tx.amount);

  const payment = await Payment.create({
    userId: req.user._id,
    price: value,
    paymentStatus: "complete",
    type: "wallet_topup",
    currencyCode: currency || "NGN",
    paymentMethod: "flutterwave",
    transactionId: idempotencyKey,
    referenceCode: `TOPUP-${Date.now()}`,
  });

  try {
    const tpl = NotificationTemplates.topUp({ amount: value });
    await createNotification({
      userId: req.user._id,
      amount: value,
      metadata: {
        paymentId: payment._id,
        txRef: tx.tx_ref || txRef || "",
        flwId: tx.id || transactionId || "",
      },
      ...tpl,
    });
  } catch (err) {
    console.error("Top-up notification failed:", err?.message || err);
  }

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Wallet topped up successfully",
    data: payment,
  });
});

export const recordWalletTopUp = catchAsync(async (req, res) => {
  const { amount, paymentMethod, transactionId } = req.body;
  const value = Number(amount);
  if (!value || value <= 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "Valid amount is required");
  }

  const payment = await Payment.create({
    userId: req.user._id,
    price: value,
    paymentStatus: "complete",
    type: "wallet_topup",
    currencyCode: req.body.currency || "NGN",
    paymentMethod: paymentMethod || "manual",
    transactionId: transactionId || "",
    referenceCode: `TOPUP-${Date.now()}`,
  });

  try {
    const tpl = NotificationTemplates.topUp({ amount: value });
    await createNotification({
      userId: req.user._id,
      amount: value,
      metadata: { paymentId: payment._id },
      ...tpl,
    });
  } catch (err) {
    console.error("Top-up notification failed:", err?.message || err);
  }

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Wallet topped up successfully",
    data: payment,
  });
});

export const listMyWithdrawals = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const status = req.query.status?.toString().trim();

  const query = {
    userId: req.user._id,
    ...(status ? { status } : {}),
  };

  const [data, total] = await Promise.all([
    Withdrawal.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Withdrawal.countDocuments(query),
  ]);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Withdrawals fetched successfully",
    data,
    meta: buildMeta(page, limit, total),
  });
});

export const getMyPaymentById = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid payment id");
  }

  const payment = await Payment.findOne({ _id: id, userId: req.user._id });
  if (!payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Payment not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment fetched successfully",
    data: payment,
  });
});
