import httpStatus from "http-status";
import mongoose from "mongoose";
import AppError from "../errors/AppError.js";
import { KycVerification } from "../model/kyc.model.js";
import { User } from "../model/user.model.js";
import {
  createIdentityVerificationSession,
  retrieveIdentityVerificationSession,
} from "../services/stripe-identity.service.js";
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

const mapStripeSessionToKycState = (session) => {
  const status = session?.status || "";
  const lastError =
    session?.last_error?.reason ||
    session?.last_error?.code ||
    session?.last_error?.type ||
    "";

  if (status === "verified" || status === "approved") {
    return {
      status: "approved",
      currentStep: "complete",
      reviewedAt: new Date(),
      rejectionReason: "",
      stripeVerificationStatus: status,
      stripeLastError: "",
    };
  }

  if (status === "requires_input" || status === "canceled") {
    return {
      status: "resubmission_required",
      currentStep: "review",
      stripeVerificationStatus: status,
      stripeLastError: lastError,
    };
  }

  return {
    status: "pending",
    currentStep: "review",
    stripeVerificationStatus: status,
    stripeLastError: lastError,
  };
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

export const createStripeVerificationSession = catchAsync(async (req, res) => {
  const userId = req.user?._id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid authenticated user id");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const session = await createIdentityVerificationSession({ user });
  const kyc = await KycVerification.findOneAndUpdate(
    { userId },
    {
      $set: {
        status: "pending",
        currentStep: "review",
        stripeVerificationId: session.id,
        stripeVerificationUrl: session.url || "",
        stripeVerificationStatus: session.status || "",
        stripeLastError: "",
        documentType: "document",
        submittedAt: new Date(),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Stripe verification session created successfully",
    data: {
      ...kyc.toObject(),
      url: session.url || "",
      clientSecret: session.client_secret || "",
    },
  });
});

export const stripeIdentityReturn = (req, res) => {
  const sessionId = (req.query.session_id || req.query.sessionId || "").toString();
  const deepLinkScheme = process.env.APP_DEEP_LINK_SCHEME || "ematony";
  const deepLink = `${deepLinkScheme}://kyc/complete${
    sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""
  }`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Returning to Ematony…</title>
  <style>
    body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#FFFCF6;color:#063627;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}
    .card{max-width:420px;width:100%;background:#fff;border-radius:18px;padding:32px 24px;box-shadow:0 10px 30px rgba(6,54,39,.08)}
    h1{font-size:22px;margin:0 0 8px;color:#146456}
    p{margin:0 0 18px;color:#4b5b56;line-height:1.5}
    a.btn{display:inline-block;background:#146456;color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600}
    .small{font-size:12px;color:#7B8A85;margin-top:18px}
  </style>
  <script>
    (function () {
      var link = ${JSON.stringify(deepLink)};
      // Bounce immediately into the app via custom scheme.
      window.location.replace(link);
      // Then try to close the tab. Browsers may block this; the page text
      // remains as a clear instruction for the user.
      setTimeout(function () {
        try { window.close(); } catch (e) {}
      }, 600);
    })();
  </script>
</head>
<body>
  <div class="card">
    <h1>Verification complete</h1>
    <p>You can close this tab and return to the Ematony app to sign in.</p>
    <a class="btn" href="${deepLink}">Open Ematony</a>
    <div class="small">If the app does not open automatically, tap the button above.</div>
  </div>
</body>
</html>`);
};

export const getStripeVerificationSessionStatus = catchAsync(async (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId?.trim()) {
    throw new AppError(httpStatus.BAD_REQUEST, "Stripe session id is required");
  }

  const kyc = await KycVerification.findOne({
    userId: req.user._id,
    stripeVerificationId: sessionId.trim(),
  });

  if (!kyc) {
    throw new AppError(httpStatus.NOT_FOUND, "KYC verification session not found");
  }

  const session = await retrieveIdentityVerificationSession(sessionId.trim());

  Object.assign(kyc, mapStripeSessionToKycState(session));
  await kyc.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Stripe verification session status fetched successfully",
    data: {
      kycApplication: kyc,
      stripeSession: {
        id: session.id,
        status: session.status,
        lastError: session.last_error || null,
        lastVerificationReport: session.last_verification_report || null,
      },
    },
  });
});
