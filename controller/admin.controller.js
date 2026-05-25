import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { User } from "../model/user.model.js";
import { Payment } from "../model/payment.model.js";
import { KycVerification } from "../model/kyc.model.js";
import { SavingsGroup } from "../model/group.model.js";
import { SupportTicket } from "../model/supportTicket.model.js";

export const getDashboardStats = catchAsync(async (req, res) => {
  const [
    totalUsers,
    totalPayments,
    revenueResult,
    lateFeeResult,
    adminCommissionResult,
    pendingKyc,
    activeGroups,
    openIssues,
  ] =
    await Promise.all([
      User.countDocuments(),
      Payment.countDocuments(),
      Payment.aggregate([
        { $match: { paymentStatus: { $in: ["complete", "succeeded"] } } },
        { $group: { _id: null, totalRevenue: { $sum: "$price" } } },
      ]),
      Payment.aggregate([
        {
          $match: {
            paymentStatus: { $in: ["complete", "succeeded"] },
            type: "late_fee_admin_credit",
          },
        },
        { $group: { _id: null, totalLateFeeRevenue: { $sum: "$price" } } },
      ]),
      Payment.aggregate([
        {
          $match: {
            paymentStatus: { $in: ["complete", "succeeded"] },
            type: "admin_commission",
          },
        },
        {
          $group: {
            _id: null,
            totalAdminCommissionRevenue: { $sum: "$price" },
          },
        },
      ]),
      KycVerification.countDocuments({ status: "pending" }),
      SavingsGroup.countDocuments({ status: { $in: ["open", "active"] } }),
      SupportTicket.countDocuments({ status: { $in: ["open", "in_progress"] } }),
    ]);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dashboard stats fetched successfully",
    data: {
      totalUsers,
      totalPayments,
      totalRevenue: revenueResult[0]?.totalRevenue ?? 0,
      lateFeeRevenue: lateFeeResult[0]?.totalLateFeeRevenue ?? 0,
      adminCommissionRevenue:
        adminCommissionResult[0]?.totalAdminCommissionRevenue ?? 0,
      pendingKyc,
      activeGroups,
      openIssues,
    },
  });
});
