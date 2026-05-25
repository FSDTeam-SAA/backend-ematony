import mongoose from "mongoose";
import {
  DEFAULT_ADMIN_PAYOUT_PERCENT,
  GROUP_GRACE_PERIOD_HOURS,
  GROUP_LATE_FEE_PERCENT,
  GROUP_MEMBER_LIMITS,
  NIGERIA_ADMIN_PAYOUT_PERCENT,
  SUPPORTED_GROUP_CURRENCIES,
  SUPPORTED_GROUP_FREQUENCIES,
  getReminderDaysForFrequency,
} from "../utils/groupPolicy.js";

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
      default: "NGN",
      trim: true,
      uppercase: true,
      enum: SUPPORTED_GROUP_CURRENCIES,
    },
    contributionFrequency: {
      type: String,
      enum: SUPPORTED_GROUP_FREQUENCIES,
      required: true,
    },
    maxMembers: {
      type: Number,
      required: true,
      min: GROUP_MEMBER_LIMITS.min,
      max: GROUP_MEMBER_LIMITS.max,
    },
    autoPaymentsEnabled: {
      type: Boolean,
      default: false,
    },
    reminderDaysBefore: {
      type: Number,
      default: function defaultReminderDays() {
        return getReminderDaysForFrequency(this.contributionFrequency);
      },
    },
    gracePeriodHours: {
      type: Number,
      default: GROUP_GRACE_PERIOD_HOURS,
      min: 1,
    },
    lateFeePercent: {
      type: Number,
      default: GROUP_LATE_FEE_PERCENT,
      min: 0,
    },
    adminPayoutPercent: {
      type: Number,
      default: DEFAULT_ADMIN_PAYOUT_PERCENT,
      min: 0,
    },
    nigeriaAdminPayoutPercent: {
      type: Number,
      default: NIGERIA_ADMIN_PAYOUT_PERCENT,
      min: 0,
    },
    wheelMode: {
      type: String,
      enum: ["serial", "spin"],
      default: "serial",
    },
    wheelSeededAt: {
      type: Date,
      default: null,
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
