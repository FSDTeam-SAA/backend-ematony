import httpStatus from "http-status";
import mongoose from "mongoose";
import AppError from "../errors/AppError.js";
import { Notification } from "../model/notification.model.js";
import { User } from "../model/user.model.js";
import catchAsync from "../utils/catchAsync.js";
import { buildMeta, parsePagination } from "../utils/pagination.js";
import sendResponse from "../utils/sendResponse.js";

const mapNotification = (notification) => {
  const item = notification?.toObject ? notification.toObject() : notification;
  return {
    ...item,
    read: item.isRead,
  };
};

export const getNotifications = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const [data, total] = await Promise.all([
    Notification.find()
      .populate("userId", "name firstName lastName email phone role avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(),
  ]);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notifications fetched successfully",
    data: data.map(mapNotification),
    meta: buildMeta(page, limit, total),
  });
});

export const markNotificationRead = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid notification id");
  }

  const notification = await Notification.findByIdAndUpdate(
    id,
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification marked as read",
    data: mapNotification(notification),
  });
});

export const sendNotification = catchAsync(async (req, res) => {
  const { title, message, userId } = req.body;
  if (!title?.trim()) {
    throw new AppError(httpStatus.BAD_REQUEST, "Title is required");
  }
  if (!message?.trim()) {
    throw new AppError(httpStatus.BAD_REQUEST, "Message is required");
  }
  if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid user id");
  }

  if (userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, "Target user not found");
    }
  }

  const notification = await Notification.create({
    title: title.trim(),
    content: message.trim(),
    userId: userId || null,
    scope: userId ? "user" : "broadcast",
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Notification sent successfully",
    data: mapNotification(notification),
  });
});

export const getMyNotifications = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const unreadOnly = req.query.unreadOnly?.toString().trim() === "true";
  const type = req.query.type?.toString().trim();

  const query = {
    $or: [{ userId: req.user._id }, { scope: "broadcast" }],
    ...(unreadOnly ? { isRead: false } : {}),
    ...(type ? { type } : {}),
  };

  const [data, total] = await Promise.all([
    Notification.find(query)
      .populate("groupId", "name")
      .populate("relatedUserId", "name avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments(query),
  ]);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Your notifications fetched successfully",
    data: data.map(mapNotification),
    meta: buildMeta(page, limit, total),
  });
});

export const markMyNotificationRead = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid notification id");
  }

  const query =
    req.user.role === "admin"
      ? { _id: id }
      : {
          _id: id,
          $or: [{ userId: req.user._id }, { scope: "broadcast" }],
        };

  const notification = await Notification.findOneAndUpdate(query, { isRead: true }, {
    new: true,
  });

  if (!notification) {
    throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification marked as read",
    data: mapNotification(notification),
  });
});

export const getMyUnreadCount = catchAsync(async (req, res) => {
  const count = await Notification.countDocuments({
    $or: [{ userId: req.user._id }, { scope: "broadcast" }],
    isRead: false,
  });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Unread notification count fetched",
    data: { count },
  });
});

export const markAllNotificationsRead = catchAsync(async (req, res) => {
  const result = await Notification.updateMany(
    {
      $or: [{ userId: req.user._id }, { scope: "broadcast" }],
      isRead: false,
    },
    { isRead: true }
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notifications marked as read",
    data: { updatedCount: result.modifiedCount },
  });
});
