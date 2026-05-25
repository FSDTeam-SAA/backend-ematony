import express from "express";
import {
  addKycDocument,
  approveKyc,
  getKycList,
  getMyKyc,
  getVerificationStatus,
  rejectKyc,
  saveKycDocumentInfo,
  saveKycPersonalInfo,
  startKyc,
  submitKyc,
  uploadKycSelfie,
  verifyIdentity,
} from "../controller/kyc.controller.js";
import { isAdmin, protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/start", protect, startKyc);
router.get("/me", protect, getMyKyc);
router.put("/personal-info", protect, saveKycPersonalInfo);
router.put("/document", protect, saveKycDocumentInfo);
router.post("/documents", protect, addKycDocument);
router.post("/selfie", protect, uploadKycSelfie);
router.post("/submit", protect, submitKyc);
router.post("/flutterwave/verify", protect, verifyIdentity);
router.get("/flutterwave/status", protect, getVerificationStatus);
router.get("/all", protect, isAdmin, getKycList);
router.patch("/:id/approve", protect, isAdmin, approveKyc);
router.patch("/:id/reject", protect, isAdmin, rejectKyc);

export default router;
