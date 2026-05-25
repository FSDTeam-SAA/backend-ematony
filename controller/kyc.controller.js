import httpStatus from "http-status";
import mongoose from "mongoose";
import AppError from "../errors/AppError.js";
import { KycVerification } from "../model/kyc.model.js";
import { User } from "../model/user.model.js";
import {
  resolveBvn,
  resolveNin,
  summariseIdentity,
} from "../services/flutterwave-identity.service.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { parsePagination, buildMeta } from "../utils/pagination.js";

const createKycQuery = (status) => ({
  ...(status ? { status } : {}),
});

const getOrCreateKycForUser = async (userId) => {
  let kyc = await KycVerification.findOne({ userId }).sort({ createdAt: -1 });
  if (!kyc) {
    kyc = await KycVerification.create({ userId, status: "draft" });
  }
  return kyc;
};

/**
 * Compares the name registered against the BVN/NIN with the legal name the
 * user typed during KYC. We do a lenient match (case-insensitive substring
 * either way) since first/last/middle ordering varies between registries.
 */
const namesLooselyMatch = (registered, claimed) => {
  if (!registered || !claimed) return false;
  const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const a = norm(registered);
  const b = norm(claimed);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
};

export const startKyc = catchAsync(async (req, res) => {
  const kyc = await getOrCreateKycForUser(req.user._id);

  if (req.body.documentType) {
    kyc.documentType = req.body.documentType;
  }
  if (!kyc.currentStep) {
    kyc.currentStep = "personal_info";
  }
  await kyc.save();

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "KYC started successfully",
    data: kyc,
  });
});

export const getMyKyc = catchAsync(async (req, res) => {
  const kyc = await getOrCreateKycForUser(req.user._id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your KYC fetched successfully",
    data: {
      kycApplication: kyc,
      documents: kyc.documents || [],
    },
  });
});

export const saveKycPersonalInfo = catchAsync(async (req, res) => {
  const { fullName, dob, addressLine1, addressLine2, city, state, postalCode, country } =
    req.body;

  if (!fullName?.trim()) {
    throw new AppError(httpStatus.BAD_REQUEST, "Full name is required");
  }
  if (!dob) {
    throw new AppError(httpStatus.BAD_REQUEST, "Date of birth is required");
  }

  const kyc = await getOrCreateKycForUser(req.user._id);
  kyc.legalFullName = fullName.trim();
  kyc.dateOfBirth = dob;
  kyc.addressLine1 = addressLine1?.trim() || "";
  kyc.addressLine2 = addressLine2?.trim() || "";
  kyc.city = city?.trim() || "";
  kyc.stateRegion = state?.trim() || "";
  kyc.postalCode = postalCode?.trim() || "";
  kyc.country = country?.trim() || "";
  kyc.currentStep = "document";
  await kyc.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "KYC personal information saved successfully",
    data: kyc,
  });
});

export const saveKycDocumentInfo = catchAsync(async (req, res) => {
  const { documentType, issuingCountry, documentNumber } = req.body;

  if (!documentType?.trim()) {
    throw new AppError(httpStatus.BAD_REQUEST, "Document type is required");
  }

  const kyc = await getOrCreateKycForUser(req.user._id);
  kyc.documentType = documentType.trim();
  kyc.issuingCountry = issuingCountry?.trim() || "";
  kyc.documentNumber = documentNumber?.trim() || "";
  kyc.currentStep = "upload";
  await kyc.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "KYC document information saved successfully",
    data: kyc,
  });
});

export const addKycDocument = catchAsync(async (req, res) => {
  const { documentSide, fileUrl, mimeType, providerFileRef } = req.body;

  if (!documentSide?.trim()) {
    throw new AppError(httpStatus.BAD_REQUEST, "Document side is required");
  }
  if (!fileUrl?.trim()) {
    throw new AppError(httpStatus.BAD_REQUEST, "File URL is required");
  }

  const kyc = await getOrCreateKycForUser(req.user._id);
  kyc.documents.push({
    documentSide: documentSide.trim(),
    fileUrl: fileUrl.trim(),
    mimeType: mimeType?.trim() || "",
    providerFileRef: providerFileRef?.trim() || "",
  });
  kyc.currentStep = documentSide === "selfie" ? "review" : "selfie";
  await kyc.save();

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "KYC document uploaded successfully",
    data: kyc.documents[kyc.documents.length - 1],
  });
});

export const uploadKycSelfie = catchAsync(async (req, res) => {
  const { fileUrl, providerRef, livenessResult } = req.body;
  if (!fileUrl?.trim()) {
    throw new AppError(httpStatus.BAD_REQUEST, "Selfie file URL is required");
  }

  const kyc = await getOrCreateKycForUser(req.user._id);
  kyc.providerRef = providerRef?.trim() || "";
  kyc.livenessResult = livenessResult?.trim() || "";
  kyc.documents.push({
    documentSide: "selfie",
    fileUrl: fileUrl.trim(),
    mimeType: req.body.mimeType?.trim() || "",
    providerFileRef: providerRef?.trim() || "",
  });
  kyc.currentStep = "review";
  await kyc.save();

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "KYC selfie uploaded successfully",
    data: kyc,
  });
});

export const submitKyc = catchAsync(async (req, res) => {
  const kyc = await getOrCreateKycForUser(req.user._id);

  if (!kyc.legalFullName || !kyc.documentType || !kyc.documents?.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "KYC is incomplete. Personal information, document type, and uploads are required"
    );
  }

  kyc.status = "pending";
  kyc.currentStep = "complete";
  kyc.submittedAt = new Date();
  kyc.rejectionReason = "";
  await kyc.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "KYC submitted successfully",
    data: kyc,
  });
});

export const getKycList = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const status = req.query.status?.toString().trim();
  const search = req.query.search?.toString().trim();

  const query = createKycQuery(status);

  const userMatch = search
    ? {
        $or: [
          { "user.name": { $regex: search, $options: "i" } },
          { "user.firstName": { $regex: search, $options: "i" } },
          { "user.lastName": { $regex: search, $options: "i" } },
          { "user.email": { $regex: search, $options: "i" } },
          { "user.phone": { $regex: search, $options: "i" } },
        ],
      }
    : null;

  let data;
  let total;
  if (userMatch) {
    const aggregateData = await KycVerification.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $match: userMatch },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: "count" }],
        },
      },
    ]);

    data = aggregateData[0]?.items || [];
    total = aggregateData[0]?.total?.[0]?.count || 0;
  } else {
    [data, total] = await Promise.all([
      KycVerification.find(query)
        .populate("userId", "name firstName lastName email phone role avatar")
        .populate("reviewedBy", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      KycVerification.countDocuments(query),
    ]);
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "KYC records fetched successfully",
    data,
    meta: buildMeta(page, limit, total),
  });
});

export const approveKyc = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid KYC id");
  }

  const kyc = await KycVerification.findById(id);
  if (!kyc) {
    throw new AppError(httpStatus.NOT_FOUND, "KYC record not found");
  }

  kyc.status = "approved";
  kyc.currentStep = "complete";
  kyc.rejectionReason = "";
  kyc.reviewedBy = req.user._id;
  kyc.reviewedAt = new Date();
  await kyc.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "KYC approved successfully",
    data: kyc,
  });
});

export const rejectKyc = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid KYC id");
  }
  if (!reason?.trim()) {
    throw new AppError(httpStatus.BAD_REQUEST, "Rejection reason is required");
  }

  const kyc = await KycVerification.findById(id);
  if (!kyc) {
    throw new AppError(httpStatus.NOT_FOUND, "KYC record not found");
  }

  kyc.status = "rejected";
  kyc.currentStep = "review";
  kyc.rejectionReason = reason.trim();
  kyc.reviewedBy = req.user._id;
  kyc.reviewedAt = new Date();
  await kyc.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "KYC rejected successfully",
    data: kyc,
  });
});

/**
 * POST /kyc/flutterwave/verify
 * Body: { type: "bvn" | "nin", id: "<11 digits>" }
 *
 * Calls Flutterwave's KYC resolver, compares the returned name with the
 * legalFullName the user previously entered, and either auto-approves or
 * marks the record for resubmission. If the Flutterwave KYC add-on isn't
 * enabled on the account, the call throws and we record the error so the
 * user can see why it didn't go through.
 */
export const verifyIdentity = catchAsync(async (req, res) => {
  const { type, id } = req.body;
  const kind = String(type || "").toLowerCase();
  if (!["bvn", "nin"].includes(kind)) {
    throw new AppError(httpStatus.BAD_REQUEST, "type must be 'bvn' or 'nin'");
  }

  const user = await User.findById(req.user._id);
  if (!user) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const kyc = await getOrCreateKycForUser(req.user._id);

  let raw;
  try {
    raw = kind === "bvn" ? await resolveBvn(id) : await resolveNin(id);
  } catch (err) {
    kyc.status = "resubmission_required";
    kyc.currentStep = "review";
    kyc.flutterwaveVerificationStatus = "failed";
    kyc.flutterwaveLastError = err?.message || "Verification failed";
    await kyc.save();

    throw new AppError(
      httpStatus.BAD_REQUEST,
      err?.message || "Identity verification failed"
    );
  }

  const summary = summariseIdentity(raw);
  const fullNameFromRegistry = `${summary?.firstName || ""} ${
    summary?.lastName || ""
  }`.trim();
  const claimedName = kyc.legalFullName || user.name || "";
  const matches = namesLooselyMatch(fullNameFromRegistry, claimedName);

  kyc.documentType = kind.toUpperCase();
  kyc.documentNumber = String(id);
  kyc.flutterwaveVerificationType = kind;
  kyc.flutterwaveVerificationId = String(id);
  kyc.flutterwaveVerificationStatus = matches ? "verified" : "name_mismatch";
  kyc.flutterwaveLastError = "";
  kyc.providerRef = `flw-${kind}-${Date.now()}`;
  kyc.submittedAt = new Date();

  if (matches) {
    kyc.status = "approved";
    kyc.currentStep = "complete";
    kyc.reviewedAt = new Date();
    kyc.rejectionReason = "";
  } else {
    kyc.status = "resubmission_required";
    kyc.currentStep = "review";
    kyc.rejectionReason = `Name on ${kind.toUpperCase()} (${fullNameFromRegistry}) does not match the name on the application (${claimedName})`;
  }
  await kyc.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: matches
      ? "Identity verified successfully"
      : "Identity verified but name does not match",
    data: {
      kycApplication: kyc,
      registry: summary,
      matches,
    },
  });
});

/**
 * Polled by the mobile app after the user resubmits, to refresh the local
 * KYC state. Now that verification is synchronous (BVN/NIN call returns
 * immediately), this is just a getter — kept for client compatibility.
 */
export const getVerificationStatus = catchAsync(async (req, res) => {
  const kyc = await getOrCreateKycForUser(req.user._id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "KYC verification status fetched",
    data: { kycApplication: kyc },
  });
});
