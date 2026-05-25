import express from "express";
import {
  getBanks,
  getPayoutStatus,
  resolveAccount,
  saveBankAccount,
} from "../controller/connect.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/banks", protect, getBanks);
router.post("/resolve", protect, resolveAccount);
router.post("/bank", protect, saveBankAccount);
router.get("/status", protect, getPayoutStatus);

export default router;
