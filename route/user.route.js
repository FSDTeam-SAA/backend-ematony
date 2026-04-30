import express from "express";
import {
  changePassword,
  deleteUserById,
  getAllUsers,
  getUserById,
  getProfile,
  toggleBlockUser,
  updateUserById,
  updateProfile,
} from "../controller/user.controller.js";

import { isAdmin, protect } from "../middleware/auth.middleware.js";
import upload from "../middleware/multer.middleware.js";
const router = express.Router();

router.get("/profile", protect, getProfile);
router.put("/profile", protect, upload.single("avatar"), updateProfile);
router.put("/password", protect, changePassword);
router.get("/all", protect, isAdmin, getAllUsers);
router.get("/:id", protect, isAdmin, getUserById);
router.put("/:id", protect, isAdmin, updateUserById);
router.delete("/:id", protect, isAdmin, deleteUserById);
router.patch("/:id/block", protect, isAdmin, toggleBlockUser);

export default router;
