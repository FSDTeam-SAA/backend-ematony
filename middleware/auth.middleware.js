import jwt from "jsonwebtoken";
import httpStatus from "http-status";
import AppError from "../errors/AppError.js";
import { User } from "./../model/user.model.js";
import { KycVerification } from "../model/kyc.model.js";

export const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) throw new AppError(httpStatus.UNAUTHORIZED, "Token not found");

  try {
    const decoded = await jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded._id);
    if (!user) {
      throw new AppError(httpStatus.UNAUTHORIZED, "User not found");
    }
    if (user.isBlocked) {
      throw new AppError(httpStatus.FORBIDDEN, "User account is blocked");
    }
    if (!(await User.isOTPVerified(user._id))) {
      throw new AppError(httpStatus.FORBIDDEN, "User verification incomplete");
    }

    // Attach KYC verification status from the KycVerification model
    // (source of truth — do not read kyc state off the User document).
    const kycRecord = await KycVerification.findOne({ userId: user._id })
      .sort({ createdAt: -1 })
      .select("status");
    req.kycStatus = kycRecord?.status || "draft";
    req.kycVerified = req.kycStatus === "approved";

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError(401, "Invalid token");
  }
};

export const requireKyc = (req, res, next) => {
  if (req.user?.role === "admin") return next();
  if (req.kycStatus !== "approved") {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "KYC verification is required to perform this action."
    );
  }
  next();
};

export const isAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    throw new AppError(403, "Access denied. You are not an admin.");
  }
  next();
};

export const isDriver = (req, res, next) => {
  if (req.user?.role !== "driver") {
    throw new AppError(403, "Access denied. You are not an driver.");
  }
  next();
};
