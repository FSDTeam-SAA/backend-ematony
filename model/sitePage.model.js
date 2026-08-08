import mongoose from "mongoose";

const pageSectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 180 },
    body: {
      type: [{ type: String, trim: true, maxlength: 5000 }],
      default: [],
    },
  },
  { _id: false }
);

const sitePageSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      enum: ["about-ajo-family", "privacy-policy", "terms-of-service", "contact"],
      required: true,
      unique: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    intro: { type: String, trim: true, default: "", maxlength: 3000 },
    content: { type: String, trim: true, default: "", maxlength: 50000 },
    updatedLabel: { type: String, trim: true, default: "" },
    sections: { type: [pageSectionSchema], default: [] },
    email: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    supportHours: { type: String, trim: true, default: "" },
    isPublished: { type: Boolean, default: true, index: true },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

export const SitePage = mongoose.model("SitePage", sitePageSchema);
