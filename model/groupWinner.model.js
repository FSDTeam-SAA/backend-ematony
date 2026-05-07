import mongoose from "mongoose";

const groupWinnerSchema = new mongoose.Schema(
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
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    cycleNumber: { type: Number, required: true, default: 1 },
    amount: { type: Number, required: true, min: 0 },
    spunAt: { type: Date, default: Date.now },
    spunBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

groupWinnerSchema.index({ groupId: 1, month: 1, year: 1 }, { unique: true });

export const GroupWinner = mongoose.model("GroupWinner", groupWinnerSchema);
