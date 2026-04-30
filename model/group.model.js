import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    inviteCode: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "open", "active", "completed", "closed"],
      default: "active",
      index: true,
    },
    contributionAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currencyCode: {
      type: String,
      default: "USD",
      trim: true,
    },
    contributionFrequency: {
      type: String,
      enum: ["weekly", "biweekly", "monthly"],
      required: true,
    },
    maxMembers: {
      type: Number,
      required: true,
      min: 2,
      max: 100,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const SavingsGroup = mongoose.model("SavingsGroup", groupSchema);
