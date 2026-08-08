import express from "express";
import {
  createWebsiteIssue,
  getPublishedPage,
  listPublishedTeam,
  listPublishedTestimonials,
} from "../controller/content.controller.js";

const router = express.Router();

router.get("/team", listPublishedTeam);
router.get("/testimonials", listPublishedTestimonials);
router.post("/contact/issues", createWebsiteIssue);
router.get("/:slug", getPublishedPage);

export default router;
