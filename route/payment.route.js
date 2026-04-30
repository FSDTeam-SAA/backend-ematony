import express from "express";
import {
  getMyPaymentById,
  getMyPayments,
  getPaymentById,
  getPayments,
} from "../controller/payment.controller.js";
import { isAdmin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/me", protect, getMyPayments);
router.get("/me/:id", protect, getMyPaymentById);
router.get("/all", protect, isAdmin, getPayments);
router.get("/:id", protect, isAdmin, getPaymentById);

export default router;
