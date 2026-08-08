import mongoose from "mongoose";

const teamMemberSchema = new mongoose.Schema(
  {
    seedKey: { type: String, trim: true, unique: true, sparse: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    role: { type: String, required: true, trim: true, maxlength: 120 },
    bio: { type: String, trim: true, default: "", maxlength: 1500 },
    imageUrl: { type: String, trim: true, default: "" },
    sortOrder: { type: Number, default: 0, index: true },
    isPublished: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const TeamMember = mongoose.model("TeamMember", teamMemberSchema);
