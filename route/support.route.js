import express from "express";
import {
  closeSupportTicket,
  createSupportTicket,
  getSupportTicket,
  listMySupportTickets,
  replyToSupportTicket,
} from "../controller/support.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/tickets", protect, createSupportTicket);
router.get("/tickets", protect, listMySupportTickets);
router.get("/tickets/:id", protect, getSupportTicket);
router.post("/tickets/:id/messages", protect, replyToSupportTicket);
router.patch("/tickets/:id/close", protect, closeSupportTicket);

export default router;
