import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
    groupId: {
      type: mongoose.Types.ObjectId,
      ref: "SavingsGroup",
      default: null,
    },
    orderId: {
      type: mongoose.Types.ObjectId,
      ref: "Order",
    },
    price: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ["complete", "pending", "failed", "initiated", "succeeded", "refunded"],
      default: 'pending',
    },
    seasonId: { type: String },
    transactionId: { type: String },
    paymentMethodNonce: { type: String },
    paymentMethod: { type: String },
    type: {
      type: String,
      enum: [
        "donation",
        "order",
        "wallet_topup",
        "group_contribution",
        "payout",
        "refund",
        "adjustment",
      ],
    },
    referenceCode: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

export const Payment = mongoose.model("Payment", paymentSchema);
export const paymentInfo = Payment;

