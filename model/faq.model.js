import mongoose from "mongoose";

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1200,
    },
    category: {
      type: String,
      trim: true,
      default: "General",
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Faq = mongoose.model("Faq", faqSchema);
