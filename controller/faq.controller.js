import httpStatus from "http-status";
import mongoose from "mongoose";
import AppError from "../errors/AppError.js";
import { Faq } from "../model/faq.model.js";
import catchAsync from "../utils/catchAsync.js";
import { buildMeta, parsePagination } from "../utils/pagination.js";
import sendResponse from "../utils/sendResponse.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const normalizePayload = (body) => ({
  question: body.question?.toString().trim(),
  answer: body.answer?.toString().trim(),
  category: body.category?.toString().trim() || "General",
  sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
  ...(typeof body.isPublished === "boolean"
    ? { isPublished: body.isPublished }
    : {}),
});

const validateRequiredPayload = (payload) => {
  if (!payload.question) {
    throw new AppError(httpStatus.BAD_REQUEST, "Question is required");
  }
  if (!payload.answer) {
    throw new AppError(httpStatus.BAD_REQUEST, "Answer is required");
  }
};

export const listPublishedFaqs = catchAsync(async (_req, res) => {
  const data = await Faq.find({ isPublished: true })
    .sort({ sortOrder: 1, createdAt: -1 })
    .select("question answer category sortOrder");

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "FAQs fetched successfully",
    data,
  });
});

export const listAdminFaqs = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const search = req.query.search?.toString().trim();
  const category = req.query.category?.toString().trim();
  const published = req.query.published?.toString().trim();

  const query = {
    ...(category ? { category } : {}),
    ...(published === "true" ? { isPublished: true } : {}),
    ...(published === "false" ? { isPublished: false } : {}),
    ...(search
      ? {
          $or: [
            { question: { $regex: search, $options: "i" } },
            { answer: { $regex: search, $options: "i" } },
            { category: { $regex: search, $options: "i" } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    Faq.find(query)
      .sort({ sortOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Faq.countDocuments(query),
  ]);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "FAQs fetched successfully",
    data,
    meta: buildMeta(page, limit, total),
  });
});

export const createFaq = catchAsync(async (req, res) => {
  const payload = normalizePayload(req.body);
  validateRequiredPayload(payload);

  const faq = await Faq.create(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "FAQ created successfully",
    data: faq,
  });
});

export const updateFaq = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid FAQ id");
  }

  const payload = normalizePayload(req.body);
  validateRequiredPayload(payload);

  const faq = await Faq.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  if (!faq) {
    throw new AppError(httpStatus.NOT_FOUND, "FAQ not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "FAQ updated successfully",
    data: faq,
  });
});

export const deleteFaq = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid FAQ id");
  }

  const faq = await Faq.findByIdAndDelete(id);
  if (!faq) {
    throw new AppError(httpStatus.NOT_FOUND, "FAQ not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "FAQ deleted successfully",
    data: faq,
  });
});
