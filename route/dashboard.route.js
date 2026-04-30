import express from "express";
import { getMemberHomeDashboard } from "../controller/dashboard.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/home", protect, getMemberHomeDashboard);

export default router;
