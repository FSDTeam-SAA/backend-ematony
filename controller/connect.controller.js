import httpStatus from "http-status";
import AppError from "../errors/AppError.js";
import { User } from "../model/user.model.js";
import {
  createOnboardingLink,
  refreshConnectStatus,
} from "../services/stripe-connect.service.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";

/** POST /connect/onboarding — returns the Stripe-hosted onboarding URL. */
export const startOnboarding = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const link = await createOnboardingLink(user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Onboarding link created",
    data: link,
  });
});

/** GET /connect/status — fetches the latest status from Stripe. */
export const getConnectStatus = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const status = await refreshConnectStatus(user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Connect status fetched",
    data: status,
  });
});
