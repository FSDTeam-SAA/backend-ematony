import httpStatus from "http-status";
import mongoose from "mongoose";
import AppError from "../errors/AppError.js";
import { GroupJoinRequest } from "../model/groupJoinRequest.model.js";
import { GroupMembership } from "../model/groupMembership.model.js";
import { GroupWinner } from "../model/groupWinner.model.js";
import { SavingsGroup } from "../model/group.model.js";
import { Payment } from "../model/payment.model.js";
import catchAsync from "../utils/catchAsync.js";
import { generateUniqueId } from "../utils/commonMethod.js";
import { buildMeta, parsePagination } from "../utils/pagination.js";
import sendResponse from "../utils/sendResponse.js";
import {
  createNotification,
  NotificationTemplates,
} from "../services/notification.service.js";
import { User } from "../model/user.model.js";

const groupProjection =
  "name description inviteCode status contributionAmount currencyCode contributionFrequency maxMembers startDate endDate ownerUserId createdAt updatedAt";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getMembership = (groupId, userId) =>
  GroupMembership.findOne({ groupId, userId, status: "active" });

const assertGroupAccess = async (groupId, userId) => {
  const membership = await getMembership(groupId, userId);
  if (!membership) {
    throw new AppError(httpStatus.FORBIDDEN, "You do not have access to this group");
  }
  return membership;
};

const assertOwnerOrAdmin = async (groupId, req) => {
  if (req.user?.role === "admin") {
    return null;
  }

  const membership = await getMembership(groupId, req.user._id);
  if (!membership || membership.membershipRole !== "owner") {
    throw new AppError(httpStatus.FORBIDDEN, "Only group owners can perform this action");
  }

  return membership;
};

const buildWheelData = async (groupId) => {
  const members = await GroupMembership.find({
    groupId,
    status: "active",
  })
    .populate("userId", "name firstName lastName email phone avatar")
    .sort({ payoutPosition: 1, joinedAt: 1, createdAt: 1 });

  const rotations = members.map((membership, index) => ({
    membershipId: membership._id,
    user: membership.userId,
    positionNumber: membership.payoutPosition || index + 1,
    membershipRole: membership.membershipRole,
    joinedAt: membership.joinedAt,
  }));

  return {
    totalMembers: members.length,
    rotations,
  };
};

export const listMyGroups = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const status = req.query.status?.toString().trim();
  const search = req.query.search?.toString().trim();

  const membershipQuery = { userId: req.user._id, status: "active" };
  const memberships = await GroupMembership.find(membershipQuery).select("groupId");
  const groupIds = memberships.map((membership) => membership.groupId);

  const query = {
    _id: { $in: groupIds },
    ...(status ? { status } : {}),
    ...(search ? { name: { $regex: search, $options: "i" } } : {}),
  };

  const [groupsRaw, total] = await Promise.all([
    SavingsGroup.find(query)
      .select(groupProjection)
      .populate("ownerUserId", "name email phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    SavingsGroup.countDocuments(query),
  ]);

  const ids = groupsRaw.map((g) => g._id);
  const memberCounts = ids.length
    ? await GroupMembership.aggregate([
        { $match: { groupId: { $in: ids }, status: "active" } },
        { $group: { _id: "$groupId", count: { $sum: 1 } } },
      ])
    : [];
  const countMap = new Map(
    memberCounts.map((m) => [String(m._id), m.count])
  );

  const data = groupsRaw.map((g) => {
    const obj = g.toObject();
    obj.membersCount = countMap.get(String(g._id)) || 0;
    return obj;
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Groups fetched successfully",
    data,
    meta: buildMeta(page, limit, total),
  });
});

export const createGroup = catchAsync(async (req, res) => {
  const {
    name,
    description,
    contributionAmount,
    frequency,
    contributionFrequency,
    maxMembers,
    startDate,
    currencyCode,
  } = req.body;

  if (!name?.trim()) {
    throw new AppError(httpStatus.BAD_REQUEST, "Group name is required");
  }
  if (!contributionAmount || Number(contributionAmount) <= 0) {
    throw new AppError(httpStatus.BAD_REQUEST, "Valid contribution amount is required");
  }
  const resolvedFrequency = contributionFrequency || frequency;
  if (!resolvedFrequency) {
    throw new AppError(httpStatus.BAD_REQUEST, "Contribution frequency is required");
  }
  if (!maxMembers || Number(maxMembers) < 3 || Number(maxMembers) > 36) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Group must allow between 3 and 36 members"
    );
  }

  if (req.kycStatus !== "approved" && req.user.role !== "admin") {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "KYC verification is required to create a group"
    );
  }

  const ownedCount = await GroupMembership.countDocuments({
    userId: req.user._id,
    membershipRole: "owner",
    status: { $in: ["active", "pending"] },
  });
  if (ownedCount >= 2) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You can create a maximum of 2 groups"
    );
  }

  const inviteCode = generateUniqueId().toUpperCase();
  const group = await SavingsGroup.create({
    ownerUserId: req.user._id,
    name: name.trim(),
    description: description?.trim() || "",
    inviteCode,
    contributionAmount: Number(contributionAmount),
    contributionFrequency: resolvedFrequency,
    maxMembers: Number(maxMembers),
    startDate: startDate || null,
    currencyCode: currencyCode || "NGN",
    status: "active",
  });

  await GroupMembership.create({
    groupId: group._id,
    userId: req.user._id,
    membershipRole: "owner",
    status: "active",
    payoutPosition: 1,
    joinedAt: new Date(),
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Group created successfully",
    data: {
      group,
      inviteCode: group.inviteCode,
    },
  });
});

export const joinGroupByCode = catchAsync(async (req, res) => {
  const inviteCode = req.body.inviteCode?.toString().trim();
  if (!inviteCode) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invite code is required");
  }

  // Case-insensitive exact match to tolerate codes generated before invite codes were normalised to uppercase.
  const escaped = inviteCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const group = await SavingsGroup.findOne({
    inviteCode: { $regex: `^${escaped}$`, $options: "i" },
  });
  if (!group) {
    throw new AppError(httpStatus.NOT_FOUND, "Group not found");
  }

  if (req.kycStatus !== "approved" && req.user.role !== "admin") {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "KYC verification is required to join a group"
    );
  }

  const joinedCount = await GroupMembership.countDocuments({
    userId: req.user._id,
    status: { $in: ["active", "pending"] },
  });
  if (joinedCount >= 2) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You can join a maximum of 2 groups"
    );
  }

  const existingMembership = await GroupMembership.findOne({
    groupId: group._id,
    userId: req.user._id,
    status: { $in: ["active", "pending"] },
  });
  if (existingMembership) {
    throw new AppError(httpStatus.CONFLICT, "You are already part of this group");
  }

  const pendingRequest = await GroupJoinRequest.findOne({
    groupId: group._id,
    userId: req.user._id,
    status: "pending",
  });
  if (pendingRequest) {
    throw new AppError(httpStatus.CONFLICT, "Join request already pending");
  }

  const activeMemberCount = await GroupMembership.countDocuments({
    groupId: group._id,
    status: "active",
  });
  if (activeMemberCount >= Math.min(group.maxMembers, 36)) {
    throw new AppError(httpStatus.CONFLICT, "Group is already full");
  }

  const joinRequest = await GroupJoinRequest.create({
    groupId: group._id,
    userId: req.user._id,
    inviteCode: group.inviteCode,
    status: "pending",
  });

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Join request sent successfully",
    data: joinRequest,
  });
});

export const listGroupRequests = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const type = req.query.type?.toString().trim() || "outgoing";
  const status = req.query.status?.toString().trim();

  let query;
  if (type === "incoming") {
    const ownerMemberships = await GroupMembership.find({
      userId: req.user._id,
      membershipRole: "owner",
      status: "active",
    }).select("groupId");

    query = {
      groupId: { $in: ownerMemberships.map((item) => item.groupId) },
      ...(status ? { status } : {}),
    };
  } else {
    query = {
      userId: req.user._id,
      ...(status ? { status } : {}),
    };
  }

  const [data, total] = await Promise.all([
    GroupJoinRequest.find(query)
      .populate("groupId", "name inviteCode status contributionAmount contributionFrequency maxMembers")
      .populate("userId", "name firstName lastName email phone avatar")
      .populate("reviewedBy", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    GroupJoinRequest.countDocuments(query),
  ]);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Group requests fetched successfully",
    data,
    meta: buildMeta(page, limit, total),
  });
});

export const approveGroupRequest = catchAsync(async (req, res) => {
  const { requestId } = req.params;
  if (!isValidObjectId(requestId)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid request id");
  }

  const joinRequest = await GroupJoinRequest.findById(requestId);
  if (!joinRequest) {
    throw new AppError(httpStatus.NOT_FOUND, "Join request not found");
  }
  if (joinRequest.status !== "pending") {
    throw new AppError(httpStatus.CONFLICT, "Join request has already been processed");
  }

  await assertOwnerOrAdmin(joinRequest.groupId, req);

  const group = await SavingsGroup.findById(joinRequest.groupId);
  if (!group) {
    throw new AppError(httpStatus.NOT_FOUND, "Group not found");
  }

  const activeMemberCount = await GroupMembership.countDocuments({
    groupId: group._id,
    status: "active",
  });
  if (activeMemberCount >= Math.min(group.maxMembers, 36)) {
    throw new AppError(httpStatus.CONFLICT, "Group is already full");
  }

  const requesterActiveCount = await GroupMembership.countDocuments({
    userId: joinRequest.userId,
    status: "active",
  });
  if (requesterActiveCount >= 2) {
    throw new AppError(
      httpStatus.CONFLICT,
      "User has already joined the maximum of 2 groups"
    );
  }

  const membership = await GroupMembership.findOneAndUpdate(
    { groupId: group._id, userId: joinRequest.userId },
    {
      $set: {
        status: "active",
        membershipRole: "member",
        joinedAt: new Date(),
        payoutPosition: activeMemberCount + 1,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  joinRequest.status = "approved";
  joinRequest.reviewedBy = req.user._id;
  joinRequest.reviewedAt = new Date();
  joinRequest.rejectionReason = "";
  await joinRequest.save();

  // Notifications: notify the joiner and the group owner
  try {
    const joiner = await User.findById(joinRequest.userId).select("name");
    const tplJoiner = NotificationTemplates.groupJoinedSelf({
      groupName: group.name,
    });
    await createNotification({
      userId: joinRequest.userId,
      groupId: group._id,
      relatedUserId: group.ownerUserId,
      ...tplJoiner,
    });

    if (String(group.ownerUserId) !== String(joinRequest.userId)) {
      const tplOwner = NotificationTemplates.groupJoinedOwner({
        groupName: group.name,
        memberName: joiner?.name || "",
      });
      await createNotification({
        userId: group.ownerUserId,
        groupId: group._id,
        relatedUserId: joinRequest.userId,
        ...tplOwner,
      });
    }
  } catch (err) {
    console.error("Group join notification failed:", err?.message || err);
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Join request approved successfully",
    data: {
      joinRequest,
      membership,
    },
  });
});

export const rejectGroupRequest = catchAsync(async (req, res) => {
  const { requestId } = req.params;
  const reason = req.body.reason?.toString().trim();

  if (!isValidObjectId(requestId)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid request id");
  }
  if (!reason) {
    throw new AppError(httpStatus.BAD_REQUEST, "Rejection reason is required");
  }

  const joinRequest = await GroupJoinRequest.findById(requestId);
  if (!joinRequest) {
    throw new AppError(httpStatus.NOT_FOUND, "Join request not found");
  }
  if (joinRequest.status !== "pending") {
    throw new AppError(httpStatus.CONFLICT, "Join request has already been processed");
  }

  await assertOwnerOrAdmin(joinRequest.groupId, req);

  joinRequest.status = "rejected";
  joinRequest.reviewedBy = req.user._id;
  joinRequest.reviewedAt = new Date();
  joinRequest.rejectionReason = reason;
  await joinRequest.save();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Join request rejected successfully",
    data: joinRequest,
  });
});

export const getGroupDetails = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid group id");
  }

  const group = await SavingsGroup.findById(id)
    .select(groupProjection)
    .populate("ownerUserId", "name firstName lastName email phone avatar");
  if (!group) {
    throw new AppError(httpStatus.NOT_FOUND, "Group not found");
  }

  const membership =
    req.user?.role === "admin" ? null : await assertGroupAccess(id, req.user._id);

  const [membersCount, pendingRequestsCount, recentTransactions, wheel] =
    await Promise.all([
      GroupMembership.countDocuments({ groupId: id, status: "active" }),
      GroupJoinRequest.countDocuments({ groupId: id, status: "pending" }),
      Payment.find({ groupId: id })
        .populate("userId", "name firstName lastName email")
        .sort({ createdAt: -1 })
        .limit(5),
      buildWheelData(id),
    ]);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Group details fetched successfully",
    data: {
      group,
      membership,
      summary: {
        membersCount,
        pendingRequestsCount,
        recentTransactions,
        wheel,
      },
    },
  });
});

export const getGroupMembers = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid group id");
  }

  if (req.user?.role !== "admin") {
    await assertGroupAccess(id, req.user._id);
  }

  const { page, limit, skip } = parsePagination(req.query);
  const query = { groupId: id, status: "active" };

  const [data, total] = await Promise.all([
    GroupMembership.find(query)
      .populate("userId", "name firstName lastName email phone avatar role")
      .sort({ payoutPosition: 1, joinedAt: 1 })
      .skip(skip)
      .limit(limit),
    GroupMembership.countDocuments(query),
  ]);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Group members fetched successfully",
    data,
    meta: buildMeta(page, limit, total),
  });
});

export const getGroupWheel = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid group id");
  }

  if (req.user?.role !== "admin") {
    await assertGroupAccess(id, req.user._id);
  }

  const group = await SavingsGroup.findById(id).select(groupProjection);
  if (!group) {
    throw new AppError(httpStatus.NOT_FOUND, "Group not found");
  }

  const wheel = await buildWheelData(id);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const day = now.getDate();

  const currentWinner = await GroupWinner.findOne({
    groupId: id,
    month,
    year,
  }).populate("userId", "name email phone avatar");

  const recentWinners = await GroupWinner.find({ groupId: id })
    .sort({ spunAt: -1 })
    .limit(12)
    .populate("userId", "name email phone avatar");

  const isOwner = String(group.ownerUserId) === String(req.user._id);
  const canSpin =
    isOwner &&
    day >= 25 &&
    day <= 30 &&
    !currentWinner &&
    wheel.totalMembers >= 3;

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Group wheel fetched successfully",
    data: {
      group,
      ...wheel,
      currentMonthWinner: currentWinner,
      recentWinners,
      canSpin,
      isOwner,
      spinWindow: { startDay: 25, endDay: 30, today: day },
    },
  });
});

export const spinGroupWheel = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid group id");
  }

  const group = await SavingsGroup.findById(id);
  if (!group) {
    throw new AppError(httpStatus.NOT_FOUND, "Group not found");
  }

  // Only the group creator can spin
  if (String(group.ownerUserId) !== String(req.user._id) && req.user.role !== "admin") {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only the group creator can spin the wheel"
    );
  }

  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Spin only allowed between day 25 and day 30
  if (day < 25 || day > 30) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "The wheel can only be spun between day 25 and day 30 of the month"
    );
  }

  // Only once per month
  const existingWinner = await GroupWinner.findOne({
    groupId: id,
    month,
    year,
  });
  if (existingWinner) {
    throw new AppError(
      httpStatus.CONFLICT,
      "The wheel has already been spun for this month"
    );
  }

  const memberships = await GroupMembership.find({
    groupId: id,
    status: "active",
  }).populate("userId", "name email phone avatar");

  if (memberships.length < 3) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Group must have at least 3 active members to spin"
    );
  }

  // Eligible: paid by 25th of this month (paymentStatus complete/succeeded)
  const monthStart = new Date(year, month - 1, 1);
  const cutoff = new Date(year, month - 1, 25, 23, 59, 59, 999);
  const paidPayments = await Payment.find({
    groupId: id,
    type: "group_contribution",
    paymentStatus: { $in: ["complete", "succeeded"] },
    createdAt: { $gte: monthStart, $lte: cutoff },
  }).select("userId");
  const paidUserIds = new Set(paidPayments.map((p) => String(p.userId)));

  // Determine current cycle: count winners in latest cycle for this group
  const allWinners = await GroupWinner.find({ groupId: id }).sort({
    cycleNumber: 1,
    spunAt: 1,
  });
  let cycleNumber = 1;
  if (allWinners.length > 0) {
    cycleNumber = allWinners[allWinners.length - 1].cycleNumber;
    const winnersInCycle = allWinners.filter(
      (w) => w.cycleNumber === cycleNumber
    );
    if (winnersInCycle.length >= memberships.length) {
      cycleNumber += 1;
    }
  }
  const previousWinnerIdsThisCycle = new Set(
    allWinners
      .filter((w) => w.cycleNumber === cycleNumber)
      .map((w) => String(w.userId))
  );

  const eligible = memberships.filter((m) => {
    const uid = String(m.userId._id || m.userId);
    return paidUserIds.has(uid) && !previousWinnerIdsThisCycle.has(uid);
  });

  if (eligible.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "No eligible members. Members must pay by the 25th and not have already won this cycle."
    );
  }

  const pick = eligible[Math.floor(Math.random() * eligible.length)];
  const winnerUserId = pick.userId._id || pick.userId;

  const winningAmount = group.contributionAmount * memberships.length;

  const winner = await GroupWinner.create({
    groupId: id,
    userId: winnerUserId,
    month,
    year,
    cycleNumber,
    amount: winningAmount,
    spunBy: req.user._id,
  });

  // Credit wallet via payout payment
  await Payment.create({
    userId: winnerUserId,
    groupId: id,
    price: winningAmount,
    paymentStatus: "complete",
    type: "payout",
    referenceCode: `WIN-${year}${String(month).padStart(2, "0")}-${String(
      winner._id
    ).slice(-6)}`,
  });

  // Notify the winner
  try {
    const tpl = NotificationTemplates.wheelWinner({
      amount: winningAmount,
      groupName: group.name,
    });
    await createNotification({
      userId: winnerUserId,
      groupId: id,
      amount: winningAmount,
      ...tpl,
    });
  } catch (err) {
    console.error("Wheel winner notification failed:", err?.message || err);
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Wheel spun successfully",
    data: {
      winner,
      winnerUser: pick.userId,
      cycleNumber,
      amount: winningAmount,
    },
  });
});

export const listAdminGroups = catchAsync(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const search = req.query.search?.toString().trim();
  const status = req.query.status?.toString().trim();

  const query = {
    ...(search ? { name: { $regex: search, $options: "i" } } : {}),
    ...(status ? { status } : {}),
  };

  const [data, total] = await Promise.all([
    SavingsGroup.find(query)
      .select(groupProjection)
      .populate("ownerUserId", "name email phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    SavingsGroup.countDocuments(query),
  ]);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin groups fetched successfully",
    data,
    meta: buildMeta(page, limit, total),
  });
});

export const updateAdminGroupStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const status = req.body.status?.toString().trim();

  if (!isValidObjectId(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid group id");
  }
  if (!status) {
    throw new AppError(httpStatus.BAD_REQUEST, "Status is required");
  }

  const group = await SavingsGroup.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true }
  ).populate("ownerUserId", "name email phone");

  if (!group) {
    throw new AppError(httpStatus.NOT_FOUND, "Group not found");
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Group status updated successfully",
    data: group,
  });
});
