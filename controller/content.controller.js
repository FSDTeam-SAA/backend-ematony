import httpStatus from "http-status";
import mongoose from "mongoose";
import sanitizeHtml from "sanitize-html";
import AppError from "../errors/AppError.js";
import { SitePage } from "../model/sitePage.model.js";
import { SupportTicket } from "../model/supportTicket.model.js";
import { TeamMember } from "../model/teamMember.model.js";
import { Testimonial } from "../model/testimonial.model.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";

const defaults = {
  "about-ajo-family": {
    title: "A familiar tradition, made clearer",
    intro:
      "Ajo Family by Ematony helps families, friends, and trusted communities organize rotating savings with shared visibility and a simple mobile experience.",
    sections: [
      {
        title: "The tradition",
        body: [
          "Ajo has helped people save together for generations. Members contribute on an agreed schedule, and each person receives the collected amount when their turn arrives.",
        ],
      },
      {
        title: "The problem",
        body: [
          "Traditional groups often depend on paper records, scattered messages, cash collection, and one person remembering every payment and payout. That can make progress hard to verify and disagreements harder to resolve.",
        ],
      },
      {
        title: "The Ajo Family solution",
        body: [
          "Ajo Family brings membership, contribution schedules, wallet activity, payout order, notifications, and support into one place so every member can understand what is happening.",
        ],
      },
    ],
  },
  "privacy-policy": {
    title: "Privacy Policy",
    updatedLabel: "August 3, 2026",
    intro:
      "This Privacy Policy explains how Ematony collects, uses, protects, and shares information when people use Ajo Family group savings, wallet, verification, notification, and support services.",
    sections: [
      { title: "Information we collect", body: ["We may collect account details such as your name, email address, phone number, password, profile photo, and other information you provide when creating or updating an Ematony account.", "When you use group savings, wallet, KYC, payment, notification, and support features, we may collect related transaction records, group membership details, verification status, device information, and support messages."] },
      { title: "How we use information", body: ["We use your information to create and secure your account, verify members, process contributions, show group progress, manage rotating payout activity, send notifications, and respond to support requests.", "We may also use information to improve product reliability, prevent misuse, investigate suspicious activity, and meet legal or regulatory obligations that apply to financial and identity-related services."] },
      { title: "Payments and verification", body: ["Payment and identity verification services may be handled by trusted third-party providers. These providers process information needed to complete wallet funding, withdrawals, identity checks, fraud prevention, and payment reconciliation.", "Ematony does not ask you to share sensitive payment credentials outside approved payment or verification flows."] },
      { title: "Sharing information", body: ["We do not sell your personal information. We may share limited information with service providers, administrators, legal authorities, or other parties when needed to operate the service, enforce our terms, resolve disputes, or comply with law.", "Inside a savings group, certain member and contribution details may be visible to group participants or administrators so the group can operate transparently."] },
      { title: "Data security", body: ["We use reasonable technical and organizational safeguards to protect account, payment, group, and verification information. No online system can be guaranteed to be completely secure.", "You are responsible for keeping your login credentials private and for notifying us if you believe your account has been compromised."] },
      { title: "Your choices", body: ["You may update account information, manage notifications where available, or contact support to request help with account access, data correction, or account-related questions.", "Some records may need to be retained for security, fraud prevention, payment reconciliation, dispute handling, or legal compliance."] },
      { title: "Contact", body: ["For privacy questions or requests, contact the Ematony support team through the official support details on this website or through the Ajo Family app."] },
    ],
  },
  "terms-of-service": {
    title: "Terms of Service",
    updatedLabel: "August 3, 2026",
    intro:
      "These Terms of Service describe the rules for using Ematony Ajo Family tools for group savings, rotating contributions, wallet activity, verification, notifications, and support.",
    sections: [
      { title: "Using Ematony", body: ["Ematony provides digital tools for trusted savings circles, group contributions, wallet activity, rotating payouts, member verification, notifications, and support workflows.", "You must provide accurate information, keep your account secure, and use the service only for lawful savings, contribution, and community investment activities."] },
      { title: "Account responsibility", body: ["You are responsible for activity that occurs under your account. Do not share your password, OTP, or other authentication details with another person.", "Ematony may restrict, suspend, or close accounts that appear fraudulent, abusive, blocked by administrators, or inconsistent with these terms."] },
      { title: "Groups and contributions", body: ["Each savings group may define its own member rules, contribution schedule, rotation order, payout expectations, and participation requirements. Members should review group details before joining or contributing.", "Group visibility is provided to help members understand payment status and upcoming rotations. Members remain responsible for understanding their obligations to their group."] },
      { title: "Payments and wallets", body: ["Wallet funding, withdrawals, payment processing, and payment status updates may depend on third-party payment providers, banking partners, network availability, and compliance checks.", "Fees, limits, processing times, reversals, failed payments, and verification requirements may apply depending on the payment method and provider."] },
      { title: "Verification and compliance", body: ["Ematony may require identity verification, KYC review, or other checks before certain account, wallet, group, or payout features are available.", "You agree not to provide false identity information, use another person's account, avoid verification checks, or use Ematony for prohibited activity."] },
      { title: "Support and disputes", body: ["Members can use support channels to report payment issues, group concerns, account access problems, or other service questions.", "Ematony may review records, group activity, payment information, and admin actions to help resolve issues, but group agreements between members may remain the responsibility of the group."] },
      { title: "Changes to the service", body: ["We may update features, policies, fees, integrations, or these terms as the product develops or as legal and operational needs change.", "If you continue using Ematony after updates become effective, you accept the updated terms."] },
      { title: "Contact", body: ["For questions about these Terms of Service, contact the Ematony support team through the official support details on this website or through the Ajo Family app."] },
    ],
  },
  contact: {
    title: "Contact Us",
    intro: "Questions about Ajo Family? Send our team a message or use the official contact details below.",
    email: "info@ajofamily.tech",
    phone: "",
    address: "",
    supportHours: "Monday to Friday, 9:00 AM–5:00 PM",
    sections: [],
  },
};

const allowedSlugs = Object.keys(defaults);
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const getDefaultPage = (slug) => ({ slug, ...defaults[slug], isPublished: true });

const richTextOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "h2", "h3", "ul", "ol", "li", "blockquote", "a"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  transformTags: {
    div: "p",
    a: (_tagName, attribs) => ({
      tagName: "a",
      attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
    }),
  },
};

const cleanRichText = (value) =>
  sanitizeHtml(value?.toString() || "", richTextOptions).trim();

const cleanPlainText = (value) =>
  sanitizeHtml(value?.toString() || "", { allowedTags: [], allowedAttributes: {} }).trim();

const ensureParagraph = (value) => {
  const cleaned = cleanRichText(value);
  if (!cleaned) return "";
  return /<\/?[a-z][\s\S]*>/i.test(cleaned) ? cleaned : `<p>${cleaned}</p>`;
};

const mergeLegacySections = (sections = []) =>
  sections
    .map((section) => {
      const title = cleanPlainText(section?.title);
      const body = Array.isArray(section?.body)
        ? section.body.map(ensureParagraph).filter(Boolean).join("")
        : "";
      return `${title ? `<h2>${title}</h2>` : ""}${body}`;
    })
    .join("");

const withSingleContent = (page) => {
  const data = typeof page?.toObject === "function" ? page.toObject() : { ...page };
  if (!data.content) data.content = mergeLegacySections(data.sections);
  return data;
};

const normalizeSections = (sections) =>
  Array.isArray(sections)
    ? sections
        .map((section) => ({
          title: cleanPlainText(section?.title),
          body: Array.isArray(section?.body)
            ? section.body.map(cleanRichText).filter(Boolean)
            : [],
        }))
        .filter((section) => section.title)
    : [];

const normalizePagePayload = (slug, body, userId) => ({
  slug,
  title: cleanPlainText(body.title),
  intro: cleanRichText(body.intro),
  content: cleanRichText(body.content),
  updatedLabel: cleanPlainText(body.updatedLabel),
  sections: normalizeSections(body.sections),
  email: body.email?.toString().trim() || "",
  phone: body.phone?.toString().trim() || "",
  address: body.address?.toString().trim() || "",
  supportHours: body.supportHours?.toString().trim() || "",
  isPublished: true,
  updatedBy: userId,
});

const assertSlug = (slug) => {
  if (!allowedSlugs.includes(slug)) {
    throw new AppError(httpStatus.NOT_FOUND, "Website page not found");
  }
};

export const getPublishedPage = catchAsync(async (req, res) => {
  const { slug } = req.params;
  assertSlug(slug);
  const page = await SitePage.findOne({ slug, isPublished: true }).select("-updatedBy");
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Website content fetched successfully", data: withSingleContent(page || getDefaultPage(slug)) });
});

export const getAdminPage = catchAsync(async (req, res) => {
  const { slug } = req.params;
  assertSlug(slug);
  const page = await SitePage.findOneAndUpdate(
    { slug },
    { $setOnInsert: getDefaultPage(slug) },
    { new: true, upsert: true, runValidators: true }
  );
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Website content fetched successfully", data: withSingleContent(page) });
});

export const updateAdminPage = catchAsync(async (req, res) => {
  const { slug } = req.params;
  assertSlug(slug);
  const payload = normalizePagePayload(slug, req.body, req.user._id);
  if (!payload.title) throw new AppError(httpStatus.BAD_REQUEST, "Title is required");
  const page = await SitePage.findOneAndUpdate({ slug }, payload, { new: true, upsert: true, runValidators: true });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Website content updated successfully", data: page });
});

const normalizeTeamPayload = (body) => ({
  name: body.name?.toString().trim(),
  role: body.role?.toString().trim(),
  bio: body.bio?.toString().trim() || "",
  imageUrl: body.imageUrl?.toString().trim() || "",
  sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
  isPublished: typeof body.isPublished === "boolean" ? body.isPublished : true,
});

const validateTeam = (payload) => {
  if (!payload.name) throw new AppError(httpStatus.BAD_REQUEST, "Team member name is required");
  if (!payload.role) throw new AppError(httpStatus.BAD_REQUEST, "Team member role is required");
};

export const listPublishedTeam = catchAsync(async (_req, res) => {
  const data = await TeamMember.find({ isPublished: true }).sort({ sortOrder: 1, createdAt: 1 });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Team fetched successfully", data });
});

export const listAdminTeam = catchAsync(async (_req, res) => {
  const data = await TeamMember.find().sort({ sortOrder: 1, createdAt: 1 });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Team fetched successfully", data });
});

export const createTeamMember = catchAsync(async (req, res) => {
  const payload = normalizeTeamPayload(req.body);
  validateTeam(payload);
  const data = await TeamMember.create(payload);
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: "Team member created successfully", data });
});

export const updateTeamMember = catchAsync(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new AppError(httpStatus.BAD_REQUEST, "Invalid team member id");
  const payload = normalizeTeamPayload(req.body);
  validateTeam(payload);
  const data = await TeamMember.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!data) throw new AppError(httpStatus.NOT_FOUND, "Team member not found");
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Team member updated successfully", data });
});

export const deleteTeamMember = catchAsync(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new AppError(httpStatus.BAD_REQUEST, "Invalid team member id");
  const data = await TeamMember.findByIdAndDelete(req.params.id);
  if (!data) throw new AppError(httpStatus.NOT_FOUND, "Team member not found");
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Team member deleted successfully", data });
});

const normalizeTestimonialPayload = (body) => ({
  name: body.name?.toString().trim(),
  review: body.review?.toString().trim(),
  rating: Math.min(5, Math.max(1, Number(body.rating) || 5)),
  location: body.location?.toString().trim() || "",
  imageUrl: body.imageUrl?.toString().trim() || "",
  sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
  isPublished: typeof body.isPublished === "boolean" ? body.isPublished : true,
});

const validateTestimonial = (payload) => {
  if (!payload.name) throw new AppError(httpStatus.BAD_REQUEST, "Reviewer name is required");
  if (!payload.review) throw new AppError(httpStatus.BAD_REQUEST, "Review is required");
};

export const listPublishedTestimonials = catchAsync(async (_req, res) => {
  const data = await Testimonial.find({ isPublished: true }).sort({ sortOrder: 1, createdAt: -1 });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Testimonials fetched successfully", data });
});

export const listAdminTestimonials = catchAsync(async (_req, res) => {
  const data = await Testimonial.find().sort({ sortOrder: 1, createdAt: -1 });
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Testimonials fetched successfully", data });
});

export const createTestimonial = catchAsync(async (req, res) => {
  const payload = normalizeTestimonialPayload(req.body);
  validateTestimonial(payload);
  const data = await Testimonial.create(payload);
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: "Testimonial created successfully", data });
});

export const updateTestimonial = catchAsync(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new AppError(httpStatus.BAD_REQUEST, "Invalid testimonial id");
  const payload = normalizeTestimonialPayload(req.body);
  validateTestimonial(payload);
  const data = await Testimonial.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!data) throw new AppError(httpStatus.NOT_FOUND, "Testimonial not found");
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Testimonial updated successfully", data });
});

export const deleteTestimonial = catchAsync(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new AppError(httpStatus.BAD_REQUEST, "Invalid testimonial id");
  const data = await Testimonial.findByIdAndDelete(req.params.id);
  if (!data) throw new AppError(httpStatus.NOT_FOUND, "Testimonial not found");
  sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Testimonial deleted successfully", data });
});

export const createWebsiteIssue = catchAsync(async (req, res) => {
  const { name, email, phone, subject, message, website } = req.body;
  if (website) {
    return sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: "Message received", data: null });
  }
  if (!name?.trim()) throw new AppError(httpStatus.BAD_REQUEST, "Name is required");
  if (!email?.trim()) throw new AppError(httpStatus.BAD_REQUEST, "Email is required");
  if (!message?.trim()) throw new AppError(httpStatus.BAD_REQUEST, "Message is required");

  const data = await SupportTicket.create({
    userId: null,
    category: "other",
    subject: subject?.toString().trim() || "Website contact request",
    message: message.toString().trim(),
    requesterName: name.toString().trim(),
    requesterEmail: email.toString().trim().toLowerCase(),
    requesterPhone: phone?.toString().trim() || "",
    source: "website",
  });
  sendResponse(res, { statusCode: httpStatus.CREATED, success: true, message: "Your message has been sent successfully", data: { id: data._id } });
});
