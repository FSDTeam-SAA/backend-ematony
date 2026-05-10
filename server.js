import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import router from "./mainroute/index.js";
import { createServer } from "http";
import { Server } from "socket.io";

import globalErrorHandler from "./middleware/globalErrorHandler.js";
import notFound from "./middleware/notFound.js";
import { startNotificationScheduler } from "./services/notification.scheduler.js";

const app = express();

app.set("trust proxy", true);

const server = createServer(app);
export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    credentials: true,
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/public", express.static("public"));

// ── Stripe Connect onboarding return pages ───────────────────────────────
// Stripe redirects the browser to these URLs after the user completes (or
// abandons) hosted Express onboarding. They are deliberately NOT under
// /api/v1 and require no auth — they are loaded directly by Stripe.
const onboardingHtml = (heading, body) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Ajo Family — ${heading}</title>
  <style>
    body { margin:0; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
           background:#FDF6EC; color:#0c2a23; min-height:100vh;
           display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { background:#fff; padding:32px 28px; border-radius:18px; max-width:380px; width:100%;
            box-shadow:0 6px 24px rgba(0,0,0,0.06); text-align:center; }
    h1 { margin:0 0 8px; font-size:22px; }
    p  { margin:0 0 20px; color:#506b62; line-height:1.5; }
    .ok  { color:#1d8569; font-weight:600; }
    .warn { color:#b87600; font-weight:600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${heading}</h1>
    <p>${body}</p>
    <p>You can now close this tab and return to the Ajo Family app.</p>
  </div>
</body>
</html>`;

app.get("/connect/return", (req, res) => {
  res.send(
    onboardingHtml(
      "<span class=\"ok\">Onboarding complete</span>",
      "Thanks — Stripe has received your details. Withdrawals will be enabled as soon as your account is fully verified."
    )
  );
});

app.get("/connect/refresh", (req, res) => {
  res.send(
    onboardingHtml(
      "<span class=\"warn\">Onboarding link expired</span>",
      "This onboarding link is no longer valid. Open the Ajo Family app and tap <strong>Set up payouts</strong> again to get a fresh link."
    )
  );
});

// Mount the main router
app.use("/api/v1", router);

// Basic route for testing
app.get("/", (req, res) => {
  res.send("Server is running...!!");
});

app.use(globalErrorHandler);
app.use(notFound);

io.on("connection", (socket) => {
  console.log("A client connected:", socket.id);

  socket.on("joinChatRoom", (userId) => {
    if (userId) {
      socket.join(`chat_${userId}`);
      console.log(`Client ${socket.id} joined user room: ${userId}`);
    }
  });

  socket.on("joinNotifications", (userId) => {
    if (userId) {
      socket.join(`user_${userId}`);
      console.log(`Client ${socket.id} joined notifications: ${userId}`);
    }
  });

  socket.on("joinAlerts", () => {
    socket.join("alerts");
    console.log(`Client ${socket.id} joined alerts room`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);

  try {
    await mongoose.connect(process.env.MONGO_DB_URL);
    console.log("MongoDB connected");
    startNotificationScheduler();
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
});
