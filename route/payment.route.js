import express from "express";
import {
  getMyPaymentById,
  getMyPayments,
  getMyWalletBalance,
  getPaymentById,
  getPayments,
  listMyWithdrawals,
  recordMonthlyContribution,
  recordWalletTopUp,
  requestWithdrawal,
  updateWithdrawalStatus,
} from "../controller/payment.controller.js";
import { isAdmin, protect, requireKyc } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/me", protect, getMyPayments);
router.get("/me/wallet", protect, getMyWalletBalance);
router.post("/me/contributions", protect, requireKyc, recordMonthlyContribution);
router.get("/me/withdrawals", protect, listMyWithdrawals);
router.post("/me/withdrawals", protect, requireKyc, requestWithdrawal);
router.post("/me/topup", protect, recordWalletTopUp);
router.patch("/withdrawals/:id/status", protect, isAdmin, updateWithdrawalStatus);
router.get("/me/:id", protect, getMyPaymentById);
router.get("/all", protect, isAdmin, getPayments);
router.get("/:id", protect, isAdmin, getPaymentById);

export default router;
