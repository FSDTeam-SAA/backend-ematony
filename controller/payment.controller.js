import httpStatus from "http-status";
import mongoose from "mongoose";
import AppError from "../errors/AppError.js";
import { Payment } from "../model/payment.model.js";
import catchAsync from "../utils/catchAsync.js";
import { buildMeta, parsePagination } from "../utils/pagination.js";
import sendResponse from "../utils/sendResponse.js";

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
