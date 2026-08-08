import mongoose from "mongoose";

const testimonialSchema = new mongoose.Schema(
  {
    seedKey: { type: String, trim: true, unique: true, sparse: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    review: { type: String, required: true, trim: true, maxlength: 2000 },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    location: { type: String, trim: true, default: "", maxlength: 120 },
    imageUrl: { type: String, trim: true, default: "" },
    sortOrder: { type: Number, default: 0, index: true },
    isPublished: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Testimonial = mongoose.model("Testimonial", testimonialSchema);
