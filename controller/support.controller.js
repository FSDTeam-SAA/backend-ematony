import httpStatus from "http-status";
import mongoose from "mongoose";
import AppError from "../errors/AppError.js";
import { SupportTicketMessage } from "../model/supportTicketMessage.model.js";
import { SupportTicket } from "../model/supportTicket.model.js";
import catchAsync from "../utils/catchAsync.js";
import { buildMeta, parsePagination } from "../utils/pagination.js";
import sendResponse from "../utils/sendResponse.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getTicketQueryForUser = (req) => {
  if (req.user?.role === "admin") {
    return {};
  }

  return { userId: req.user._id };
};

export const createSupportTicket = catchAsync(async (req, res) => {
  const { groupId, category, subject, message } = req.body;

  if (!category) {
    throw new AppError(httpStatus.BAD_REQUEST, "Issue category is required");
  }
  if (!message?.trim()) {
    throw new AppError(httpStatus.BAD_REQUEST, "Message is required");
  }
  if (groupId && !isValidObjectId(groupId)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid group id");
  }

  const ticket = await SupportTicket.create({
    userId: req.user._id,
    groupId: groupId || null,
    category,
    subject: subject?.trim() || "",
    message: message.trim(),
  });

  await SupportTicketMessage.create({
    ticketId: ticket._id,
    senderUserId: req.user._id,
    senderRole: req.user.role === "admin" ? "admin" : "member",
    message: message.trim(),
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Support ticket created successfully",
    data: ticket,
  });
});

export const listMySupportTickets = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const status = req.query.status?.toString().trim();

  const query = {
    userId: req.user._id,
    ...(status ? { status } : {}),
  };

  const [data, total] = await Promise.all([
    SupportTicket.find(query)
      .populate("groupId", "name inviteCode")
      .populate("assignedAdminId", "name email")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit),
    SupportTicket.countDocuments(query),
  ]);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Support tickets fetched successfully",
    data,
    meta: buildMeta(page, limit, total),
  });
});

export const getSupportTicket = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid ticket id");
  }

  const accessQuery = getTicketQueryForUser(req);
  const ticket = await SupportTicket.findOne({ _id: id, ...accessQuery })
    .populate("userId", "name firstName lastName email phone avatar")
    .populate("groupId", "name inviteCode")
    .populate("assignedAdminId", "name email role");

  if (!ticket) {
    throw new AppError(httpStatus.NOT_FOUND, "Support ticket not found");
  }

  const messages = await SupportTicketMessage.find({ ticketId: ticket._id })
    .populate("senderUserId", "name firstName lastName email avatar role")
    .sort({ createdAt: 1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Support ticket fetched successfully",
    data: {
      ticket,
      messages,
    },
  });
});

export const replyToSupportTicket = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { message, attachmentUrl } = req.body;

  if (!isValidObjectId(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid ticket id");
  }
  if (!message?.trim()) {
    throw new AppError(httpStatus.BAD_REQUEST, "Message is required");
  }

  const accessQuery = getTicketQueryForUser(req);
  const ticket = await SupportTicket.findOne({ _id: id, ...accessQuery });
  if (!ticket) {
    throw new AppError(httpStatus.NOT_FOUND, "Support ticket not found");
  }

  if (ticket.status === "closed") {
    throw new AppError(httpStatus.CONFLICT, "Closed tickets cannot be updated");
  }

  const ticketMessage = await SupportTicketMessage.create({
    ticketId: ticket._id,
    senderUserId: req.user._id,
    senderRole: req.user.role === "admin" ? "admin" : "member",
    message: message.trim(),
    attachmentUrl: attachmentUrl?.trim() || "",
  });

  if (req.user.role === "admin" && ticket.status === "open") {
    ticket.status = "in_progress";
    ticket.assignedAdminId = ticket.assignedAdminId || req.user._id;
    await ticket.save();
  } else {
    ticket.updatedAt = new Date();
    await ticket.save();
  }

  const populatedMessage = await SupportTicketMessage.findById(ticketMessage._id)
    .populate("senderUserId", "name firstName lastName email avatar role");

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Support ticket reply created successfully",
    data: populatedMessage,
  });
});

export const closeSupportTicket = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid ticket id");
  }

  const accessQuery = getTicketQueryForUser(req);
  const ticket = await SupportTicket.findOne({ _id: id, ...accessQuery });
  if (!ticket) {
    throw new AppError(httpStatus.NOT_FOUND, "Support ticket not found");
  }

  ticket.status = "closed";
  ticket.resolvedAt = new Date();
  await ticket.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Support ticket closed successfully",
    data: ticket,
  });
});

export const listAdminIssues = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const status = req.query.status?.toString().trim();
  const category = req.query.category?.toString().trim();
  const priority = req.query.priority?.toString().trim();
  const search = req.query.search?.toString().trim();

  const query = {
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
    ...(priority ? { priority } : {}),
    ...(search
      ? {
          $or: [
            { subject: { $regex: search, $options: "i" } },
            { message: { $regex: search, $options: "i" } },
            { requesterName: { $regex: search, $options: "i" } },
            { requesterEmail: { $regex: search, $options: "i" } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    SupportTicket.find(query)
      .populate("userId", "name firstName lastName email phone avatar")
      .populate("groupId", "name inviteCode")
      .populate("assignedAdminId", "name email role")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit),
    SupportTicket.countDocuments(query),
  ]);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Issues fetched successfully",
    data,
    meta: buildMeta(page, limit, total),
  });
});

export const assignSupportIssue = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { assignedAdminId } = req.body;

  if (!isValidObjectId(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid ticket id");
  }
  if (!assignedAdminId || !isValidObjectId(assignedAdminId)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Valid assigned admin id is required");
  }

  const ticket = await SupportTicket.findByIdAndUpdate(
    id,
    {
      assignedAdminId,
      ...(req.body.status ? { status: req.body.status } : {}),
    },
    { new: true, runValidators: true }
  )
    .populate("userId", "name firstName lastName email phone avatar")
    .populate("assignedAdminId", "name email role");

  if (!ticket) {
    throw new AppError(httpStatus.NOT_FOUND, "Support ticket not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Issue assigned successfully",
    data: ticket,
  });
});

export const updateSupportIssueStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status, priority } = req.body;

  if (!isValidObjectId(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid ticket id");
  }
  if (!status) {
    throw new AppError(httpStatus.BAD_REQUEST, "Status is required");
  }

  const update = {
    status,
    ...(priority ? { priority } : {}),
    ...(status === "resolved" || status === "closed"
      ? { resolvedAt: new Date() }
      : {}),
  };

  const ticket = await SupportTicket.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  })
    .populate("userId", "name firstName lastName email phone avatar")
    .populate("assignedAdminId", "name email role");

  if (!ticket) {
    throw new AppError(httpStatus.NOT_FOUND, "Support ticket not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Issue updated successfully",
    data: ticket,
  });
});
