import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new Schema(
  {
    name: { type: String },
    email: {
      type: String,
      trim: true,
    },
    password: { type: String, select: false },
    username: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    bio: { type: String, maxlength: 500 },
    interests: [
      {
        type: String,
        maxlength: 100,
      },
    ],
    avatar: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
    },
    location: { type: String },
    addresses: {
      type: Array,
      default: [],
    },
    notifications: {
      type: Boolean,
      default: true,
    },
    referralCode: {
      type: String,
      default: () => Math.random().toString(36).substr(2, 9).toUpperCase(),
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    isBlocked: { type: Boolean, default: false },
    verificationInfo: {
      verified: { type: Boolean, default: false },
      token: { type: String, default: "" },
    },
    password_reset_token: { type: String, default: "" },
    refreshToken: { type: String, default: "" },
    flutterwaveCustomerId: { type: String, default: "" },
    bankAccount: {
      number: { type: String, default: "" },
      bankCode: { type: String, default: "" },
      bankName: { type: String, default: "" },
      accountName: { type: String, default: "" },
      currency: { type: String, default: "NGN" },
    },
    payoutsEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    const saltRounds = Number(process.env.bcrypt_salt_round) || 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
  }
  if (this.isModified("addresses")) {
    let defaultFound = false;

    this.addresses = this.addresses.map((addr) => {
      if (addr.isDefault) {
        if (!defaultFound) {
          defaultFound = true;
          return addr;
        }
        addr.isDefault = false;
      }
      return addr;
    });
  }
  next();
});

userSchema.statics.isUserExistsByEmail = async function (email) {
  return await this.findOne({ email }).select("+password");
};

userSchema.statics.isOTPVerified = async function (id) {
  const user = await this.findById(id).select("+verificationInfo");
  return user?.verificationInfo.verified;
};

userSchema.statics.isPasswordMatched = async function (
  plainTextPassword,
  hashPassword
) {
  return await bcrypt.compare(plainTextPassword, hashPassword);
};

userSchema.statics.findByPhone = async function (phone) {
  return await this.findOne({ phone });
};

export const User = mongoose.model("User", userSchema);
