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

// ── Flutterwave checkout return page ──────────────────────────────────────
// Flutterwave redirects the user's browser here after a hosted-checkout
// payment completes (or is cancelled). The page bounces straight back into
// the app via the configured deep-link scheme so the wallet screen can call
// /payment/me/topup/confirm with the tx_ref.
app.get("/payments/return", (req, res) => {
  const status = String(req.query.status || "").toLowerCase();
  const txRef = String(req.query.tx_ref || "");
  const transactionId = String(req.query.transaction_id || "");
  const deepLinkScheme = process.env.APP_DEEP_LINK_SCHEME || "ematony";

  const params = new URLSearchParams();
  if (status) params.append("status", status);
  if (txRef) params.append("tx_ref", txRef);
  if (transactionId) params.append("transaction_id", transactionId);
  const qs = params.toString();
  const deepLink = `${deepLinkScheme}://payments/return${qs ? `?${qs}` : ""}`;

  const heading =
    status === "successful" || status === "completed"
      ? '<span style="color:#1d8569;font-weight:600">Payment received</span>'
      : status === "cancelled"
      ? '<span style="color:#b87600;font-weight:600">Payment cancelled</span>'
      : "Returning to the app…";

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Returning to Ajo Family…</title>
  <style>
    body { margin:0; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
           background:#FDF6EC; color:#0c2a23; min-height:100vh;
           display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { background:#fff; padding:32px 28px; border-radius:18px; max-width:420px; width:100%;
            box-shadow:0 6px 24px rgba(0,0,0,0.06); text-align:center; }
    h1 { margin:0 0 8px; font-size:22px; color:#146456; }
    p { margin:0 0 18px; color:#506b62; line-height:1.5; }
    a.btn { display:inline-block; background:#146456; color:#fff; text-decoration:none;
            padding:12px 22px; border-radius:12px; font-weight:600; }
    .small { font-size:12px; color:#7B8A85; margin-top:18px; }
  </style>
  <script>
    (function () {
      var link = ${JSON.stringify(deepLink)};
      window.location.replace(link);
      setTimeout(function () { try { window.close(); } catch (e) {} }, 600);
    })();
  </script>
</head>
<body>
  <div class="card">
    <h1>${heading}</h1>
    <p>You can close this tab and return to the Ajo Family app.</p>
    <a class="btn" href="${deepLink}">Open Ajo Family</a>
    <div class="small">If the app does not open automatically, tap the button above.</div>
  </div>
</body>
</html>`);
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
