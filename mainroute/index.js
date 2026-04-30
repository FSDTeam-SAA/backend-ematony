import express from "express";

import adminRoute from "../route/admin.route.js";
import authRoute from "../route/auth.route.js";
import dashboardRoute from "../route/dashboard.route.js";
import groupRoute from "../route/group.route.js";
import kycRoute from "../route/kyc.route.js";
import notificationRoute from "../route/notification.route.js";
import paymentRoute from "../route/payment.route.js";
import supportRoute from "../route/support.route.js";
import userRoute from "../route/user.route.js";

const router = express.Router();

// Mounting the routes
router.use("/admin", adminRoute);
router.use("/auth", authRoute);
router.use("/dashboard", dashboardRoute);
router.use("/groups", groupRoute);
router.use("/kyc", kycRoute);
router.use("/notification", notificationRoute);
router.use("/notifications", notificationRoute);
router.use("/payment", paymentRoute);
router.use("/support", supportRoute);
router.use("/user", userRoute);

export default router;
