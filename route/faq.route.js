import express from "express";
import { listPublishedFaqs } from "../controller/faq.controller.js";

const router = express.Router();

router.get("/", listPublishedFaqs);

export default router;
