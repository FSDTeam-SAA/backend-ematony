import { Notification } from "../model/notification.model.js";
import { io } from "../server.js";

const VALID_TYPES = new Set([
  "payment_reminder",
  "wheel_winner",
  "top_up",
  "withdrawal",
  "group_join",
  "general",
]);

const emitToUser = (userId, notification) => {
  if (!userId) return;
  try {
    io.to(`chat_${userId}`).emit("notification:new", notification);
    io.to(`user_${userId}`).emit("notification:new", notification);
  } catch (err) {
    // Socket emission failures must not break business logic
    console.error("Notification socket emit failed:", err?.message || err);
  }
};

export const createNotification = async ({
  userId,
  title,
  message,
  type = "general",
  groupId = null,
  relatedUserId = null,
  amount = null,
  metadata = null,
}) => {
  if (!userId) return null;
  const safeType = VALID_TYPES.has(type) ? type : "general";
  const body = (message || title || "").trim();

  const notification = await Notification.create({
    userId,
    title: (title || "Notification").trim(),
    content: body,
    message: body,
    type: safeType,
    groupId,
    relatedUserId,
    amount,
    metadata,
    scope: "user",
    isRead: false,
  });

  emitToUser(userId, notification);
  return notification;
};

export const createNotifications = async (items = []) => {
  const created = [];
  for (const item of items) {
    const note = await createNotification(item);
    if (note) created.push(note);
  }
  return created;
};

const formatAmount = (amount, currency = "₦") => {
  if (amount == null) return "";
  return `${currency}${Number(amount).toLocaleString()}`;
};

export const NotificationTemplates = {
  paymentReminder: ({ groupName }) => ({
    title: "Monthly payment pending",
    message: groupName
      ? `Your monthly payment for ${groupName} is still pending. Please pay before the wheel starts.`
      : "Your monthly group payment is still pending. Please pay before the wheel starts.",
    type: "payment_reminder",
  }),
  wheelWinner: ({ amount, groupName }) => ({
    title: "You won the wheel!",
    message: amount
      ? `Congratulations! You won ${formatAmount(amount)}${
          groupName ? ` from ${groupName}` : ""
        } in this month's group wheel.`
      : `Congratulations! You won this month's group wheel${
          groupName ? ` (${groupName})` : ""
        }.`,
    type: "wheel_winner",
  }),
  topUp: ({ amount }) => ({
    title: "Wallet top-up successful",
    message: `You topped up ${formatAmount(amount)} in your wallet.`,
    type: "top_up",
  }),
  withdrawalRequested: ({ amount }) => ({
    title: "Withdrawal request submitted",
    message: `Your withdrawal request of ${formatAmount(amount)} has been submitted.`,
    type: "withdrawal",
  }),
  withdrawalApproved: ({ amount }) => ({
    title: "Withdrawal approved",
    message: `You withdrew ${formatAmount(amount)} from your wallet.`,
    type: "withdrawal",
  }),
  withdrawalRejected: ({ amount, reason }) => ({
    title: "Withdrawal rejected",
    message: `Your withdrawal request of ${formatAmount(amount)} was rejected${
      reason ? `: ${reason}` : "."
    }`,
    type: "withdrawal",
  }),
  groupJoinedSelf: ({ groupName }) => ({
    title: "Group joined",
    message: groupName
      ? `You have successfully joined the group: ${groupName}.`
      : "You have successfully joined the group.",
    type: "group_join",
  }),
  groupJoinedOwner: ({ groupName, memberName }) => ({
    title: "New member joined",
    message: `${memberName ? `${memberName} ` : "A new member "}joined your group${
      groupName ? `: ${groupName}` : ""
    }.`,
    type: "group_join",
  }),
};
