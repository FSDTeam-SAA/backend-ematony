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
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const existing = await Payment.findOne({
    userId: req.user._id,
    groupId,
    type: "group_contribution",
    paymentStatus: { $in: ["complete", "succeeded"] },
    createdAt: { $gte: monthStart, $lte: monthEnd },
  });
  if (existing) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You have already paid this month's contribution"
    );
  }

  const day = now.getDate();
  const eligibleForWheel = day <= 25;

  const payment = await Payment.create({
    userId: req.user._id,
    groupId,
    price: group.contributionAmount,
    paymentStatus: "complete",
    type: "group_contribution",
    paymentMethod: paymentMethod || "manual",
    transactionId: transactionId || "",
    referenceCode: `CONTRIB-${year}${String(month).padStart(2, "0")}-${String(
      req.user._id
    ).slice(-6)}`,
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: eligibleForWheel
      ? "Monthly contribution recorded. You are eligible for this month's wheel."
      : "Monthly contribution recorded. Note: payment was after the 25th, so you are not eligible for this month's wheel.",
    data: { payment, eligibleForWheel, month, year },
  });
});

export const getMyWalletBalance = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const payouts = await Payment.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        type: "payout",
        paymentStatus: { $in: ["complete", "succeeded"] },
      },
    },
    { $group: { _id: null, total: { $sum: "$price" } } },
  ]);

  const withdrawals = await Withdrawal.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        status: { $in: ["pending", "approved", "paid"] },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const totalEarned = payouts[0]?.total || 0;
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
  const { amount, method, accountDetails, note } = req.body;
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
  const [payouts, withdrawals] = await Promise.all([
    Payment.aggregate([
      {
        $match: {
          userId,
          type: "payout",
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
    (payouts[0]?.total || 0) - (withdrawals[0]?.total || 0);

  if (value > available) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Insufficient balance. Available: ${available}`
    );
  }

  const withdrawal = await Withdrawal.create({
    userId: req.user._id,
    amount: value,
    method: method || "",
    accountDetails: accountDetails || "",
    note: note || "",
    status: "pending",
  });

  try {
    const tpl = NotificationTemplates.withdrawalRequested({ amount: value });
    await createNotification({
      userId: req.user._id,
      amount: value,
      metadata: { withdrawalId: withdrawal._id },
      ...tpl,
    });
  } catch (err) {
    console.error("Withdrawal notification failed:", err?.message || err);
  }

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Withdrawal request submitted successfully",
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
