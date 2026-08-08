import mongoose from "mongoose";

const supportTicketSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    requesterName: { type: String, trim: true, default: "" },
    requesterEmail: { type: String, trim: true, lowercase: true, default: "" },
    requesterPhone: { type: String, trim: true, default: "" },
    source: {
      type: String,
      enum: ["mobile_app", "website", "admin"],
      default: "mobile_app",
      index: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SavingsGroup",
      default: null,
      index: true,
    },
    category: {
      type: String,
      enum: [
        "payment_transaction",
        "membership_access",
        "technical_issue",
        "feedback_suggestion",
        "other",
      ],
      required: true,
      index: true,
    },
    subject: {
      type: String,
      trim: true,
      default: "",
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
      index: true,
    },
    assignedAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);
