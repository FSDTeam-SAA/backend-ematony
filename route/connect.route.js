import express from "express";
import {
  getConnectStatus,
  startOnboarding,
} from "../controller/connect.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/onboarding", protect, startOnboarding);
router.get("/status", protect, getConnectStatus);

export default router;
