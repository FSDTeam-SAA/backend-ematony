import express from "express";
import {
  approveGroupRequest,
  createGroup,
  getGroupDetails,
  getGroupMembers,
  getGroupWheel,
  joinGroupByCode,
  listGroupRequests,
  listMyGroups,
  rejectGroupRequest,
} from "../controller/group.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protect, listMyGroups);
router.post("/", protect, createGroup);
router.post("/join-by-code", protect, joinGroupByCode);
router.get("/requests", protect, listGroupRequests);
router.patch("/requests/:requestId/approve", protect, approveGroupRequest);
router.patch("/requests/:requestId/reject", protect, rejectGroupRequest);
router.get("/:id", protect, getGroupDetails);
router.get("/:id/members", protect, getGroupMembers);
router.get("/:id/wheel", protect, getGroupWheel);

export default router;
