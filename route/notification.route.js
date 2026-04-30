import express from "express";
import {
  getNotifications,
  getMyNotifications,
  markAllNotificationsRead,
  markMyNotificationRead,
  markNotificationRead,
  sendNotification,
} from "../controller/notification.controller.js";
import { isAdmin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protect, getMyNotifications);
router.patch("/read-all", protect, markAllNotificationsRead);
router.patch("/:id/read", protect, markMyNotificationRead);
router.get("/all", protect, isAdmin, getNotifications);
router.post("/send", protect, isAdmin, sendNotification);
router.patch("/admin/:id/read", protect, isAdmin, markNotificationRead);

export default router;
