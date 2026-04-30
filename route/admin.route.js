import express from "express";
import { getDashboardStats } from "../controller/admin.controller.js";
import {
  approveKyc,
  getKycList,
  rejectKyc,
} from "../controller/kyc.controller.js";
import {
  listAdminGroups,
  updateAdminGroupStatus,
  getGroupDetails,
} from "../controller/group.controller.js";
import { getNotifications, sendNotification } from "../controller/notification.controller.js";
import { getPayments, getPaymentById } from "../controller/payment.controller.js";
import { assignSupportIssue, listAdminIssues, updateSupportIssueStatus } from "../controller/support.controller.js";
import { getAllUsers, getUserById, updateUserById, deleteUserById, toggleBlockUser } from "../controller/user.controller.js";
import { isAdmin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/dashboard/stats", protect, isAdmin, getDashboardStats);
router.get("/users", protect, isAdmin, getAllUsers);
router.get("/users/:id", protect, isAdmin, getUserById);
router.put("/users/:id", protect, isAdmin, updateUserById);
router.delete("/users/:id", protect, isAdmin, deleteUserById);
router.patch("/users/:id/block", protect, isAdmin, toggleBlockUser);

router.get("/groups", protect, isAdmin, listAdminGroups);
router.get("/groups/:id", protect, isAdmin, getGroupDetails);
router.patch("/groups/:id/status", protect, isAdmin, updateAdminGroupStatus);

router.get("/kyc", protect, isAdmin, getKycList);
router.patch("/kyc/:id/approve", protect, isAdmin, approveKyc);
router.patch("/kyc/:id/reject", protect, isAdmin, rejectKyc);

router.get("/transactions", protect, isAdmin, getPayments);
router.get("/transactions/:id", protect, isAdmin, getPaymentById);

router.get("/notifications", protect, isAdmin, getNotifications);
router.post("/notifications", protect, isAdmin, sendNotification);

router.get("/issues", protect, isAdmin, listAdminIssues);
router.patch("/issues/:id/assign", protect, isAdmin, assignSupportIssue);
router.patch("/issues/:id/status", protect, isAdmin, updateSupportIssueStatus);

export default router;
