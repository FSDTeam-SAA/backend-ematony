import httpStatus from "http-status";
import { GroupJoinRequest } from "../model/groupJoinRequest.model.js";
import { GroupMembership } from "../model/groupMembership.model.js";
import { Notification } from "../model/notification.model.js";
import { Payment } from "../model/payment.model.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";

export const getMemberHomeDashboard = catchAsync(async (req, res) => {
  const [activeGroups, pendingRequests, recentTransactions, recentNotifications] =
    await Promise.all([
      GroupMembership.countDocuments({
        userId: req.user._id,
        status: "active",
      }),
      GroupJoinRequest.countDocuments({
        userId: req.user._id,
        status: "pending",
      }),
      Payment.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(5),
      Notification.find({
        $or: [{ userId: req.user._id }, { scope: "broadcast" }],
      })
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

  const walletSummary = recentTransactions.reduce(
    (acc, item) => {
      if (item.paymentStatus === "complete" || item.paymentStatus === "succeeded") {
        acc.totalCompleted += item.price;
      }
      if (item.paymentStatus === "pending") {
        acc.totalPending += item.price;
      }
      return acc;
    },
    { totalCompleted: 0, totalPending: 0 }
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Home dashboard fetched successfully",
    data: {
      walletSummary,
      activeGroups,
      pendingRequests,
      recentTransactions,
      recentNotifications,
    },
  });
});
