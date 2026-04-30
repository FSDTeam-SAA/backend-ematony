import mongoose from "mongoose";

const supportTicketMessageSchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportTicket",
      required: true,
      index: true,
    },
    senderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["member", "admin"],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    attachmentUrl: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

export const SupportTicketMessage = mongoose.model(
  "SupportTicketMessage",
  supportTicketMessageSchema
);
