import mongoose from "mongoose";

const groupMembershipSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SavingsGroup",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    membershipRole: {
      type: String,
      enum: ["owner", "member"],
      default: "member",
    },
    status: {
      type: String,
      enum: ["pending", "active", "rejected", "left", "removed"],
      default: "active",
      index: true,
    },
    payoutPosition: {
      type: Number,
      default: null,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

groupMembershipSchema.index({ groupId: 1, userId: 1 }, { unique: true });

export const GroupMembership = mongoose.model(
  "GroupMembership",
  groupMembershipSchema
);
