import mongoose from "mongoose";

const kycSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected", "resubmission_required"],
      default: "draft",
      index: true,
    },
    currentStep: {
      type: String,
      enum: ["personal_info", "document", "upload", "selfie", "review", "complete"],
      default: "personal_info",
    },
    legalFullName: {
      type: String,
      trim: true,
      default: "",
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    addressLine1: {
      type: String,
      trim: true,
      default: "",
    },
    addressLine2: {
      type: String,
      trim: true,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      default: "",
    },
    stateRegion: {
      type: String,
      trim: true,
      default: "",
    },
    postalCode: {
      type: String,
      trim: true,
      default: "",
    },
    country: {
      type: String,
      trim: true,
      default: "",
    },
    documentType: {
      type: String,
      trim: true,
      default: "",
    },
    documentNumber: {
      type: String,
      trim: true,
      default: "",
    },
    issuingCountry: {
      type: String,
      trim: true,
      default: "",
    },
    stripeVerificationId: {
      type: String,
      trim: true,
      default: "",
    },
    stripeVerificationUrl: {
      type: String,
      trim: true,
      default: "",
    },
    stripeVerificationStatus: {
      type: String,
      trim: true,
      default: "",
    },
    stripeLastError: {
      type: String,
      trim: true,
      default: "",
    },
    providerRef: {
      type: String,
      trim: true,
      default: "",
    },
    livenessResult: {
      type: String,
      trim: true,
      default: "",
    },
    documents: [
      {
        documentSide: {
          type: String,
          enum: ["front", "back", "selfie", "extra"],
          required: true,
        },
        fileUrl: {
          type: String,
          required: true,
          trim: true,
        },
        mimeType: {
          type: String,
          trim: true,
          default: "",
        },
        providerFileRef: {
          type: String,
          trim: true,
          default: "",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const KycVerification = mongoose.model("KycVerification", kycSchema);
