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

/**
 * =========================================================
 * HTTP SERVER
 * =========================================================
 */

const server = createServer(app);

/**
 * =========================================================
 * CORS CONFIGURATION
 * =========================================================
 *
 * IMPORTANT:
 * We cannot use:
 *
 * credentials: true
 * origin: "*"
 *
 * Browsers do not allow wildcard origins with credentials.
 */

const allowedOrigins = [
  "https://jofamily.tech",
  "https://www.jofamily.tech",
  "https://ajofamily.tech",
  "https://www.ajofamily.tech",

  // Local development
  "http://localhost:3000",
  "http://localhost:5173",
];

/**
 * Express API CORS
 */
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without an Origin header.
    // Useful for Postman, server-to-server requests, etc.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`CORS blocked origin: ${origin}`);

    return callback(new Error("Not allowed by CORS"));
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
};

app.use(cors(corsOptions));

/**
 * =========================================================
 * BODY PARSERS
 * =========================================================
 */

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

/**
 * =========================================================
 * COOKIE PARSER
 * =========================================================
 */

app.use(cookieParser());

/**
 * =========================================================
 * STATIC FILES
 * =========================================================
 */

app.use("/public", express.static("public"));

/**
 * =========================================================
 * FLUTTERWAVE PAYMENT RETURN
 * =========================================================
 *
 * Flutterwave redirects the user's browser here after
 * hosted checkout completes or is cancelled.
 */

app.get("/payments/return", (req, res) => {
  const status = String(req.query.status || "").toLowerCase();

  const txRef = String(req.query.tx_ref || "");

  const transactionId = String(
    req.query.transaction_id || ""
  );

  const deepLinkScheme =
    process.env.APP_DEEP_LINK_SCHEME || "ematony";

  /**
   * Build deep-link query parameters
   */
  const params = new URLSearchParams();

  if (status) {
    params.append("status", status);
  }

  if (txRef) {
    params.append("tx_ref", txRef);
  }

  if (transactionId) {
    params.append("transaction_id", transactionId);
  }

  const queryString = params.toString();

  const deepLink = `${deepLinkScheme}://payments/return${
    queryString ? `?${queryString}` : ""
  }`;

  /**
   * Heading
   */
  let heading = "Returning to the app...";

  if (
    status === "successful" ||
    status === "completed"
  ) {
    heading = "Payment received";
  } else if (status === "cancelled") {
    heading = "Payment cancelled";
  }

  /**
   * HTML response
   */
  res.setHeader(
    "Content-Type",
    "text/html; charset=utf-8"
  );

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />

        <title>Payment</title>

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            min-height: 100vh;

            display: flex;
            align-items: center;
            justify-content: center;

            font-family:
              Arial,
              Helvetica,
              sans-serif;

            background: #f5f7fa;
            color: #222;
          }

          .container {
            width: min(90%, 420px);

            padding: 32px;

            text-align: center;

            background: #ffffff;

            border-radius: 16px;

            box-shadow:
              0 10px 30px
              rgba(0, 0, 0, 0.08);
          }

          h1 {
            margin-bottom: 12px;
          }

          p {
            color: #666;
            line-height: 1.5;
          }

          .button {
            display: inline-block;

            margin-top: 20px;

            padding: 12px 20px;

            background: #0f766e;

            color: #ffffff;

            text-decoration: none;

            border-radius: 8px;
          }
        </style>
      </head>

      <body>
        <div class="container">

          <h1>
            ${heading}
          </h1>

          <p>
            You will be redirected back to the app automatically.
          </p>

          <a
            class="button"
            href="${deepLink}"
          >
            Return to App
          </a>

        </div>

        <script>
          setTimeout(() => {
            window.location.href =
              ${JSON.stringify(deepLink)};
          }, 1000);
        </script>
      </body>
    </html>
  `);
});

/**
 * =========================================================
 * API ROUTES
 * =========================================================
 */

app.use("/api/v1", router);

/**
 * =========================================================
 * BASIC HEALTH CHECK
 * =========================================================
 */

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running...!!",
  });
});

/**
 * =========================================================
 * ERROR HANDLERS
 * =========================================================
 *
 * These must come AFTER all routes.
 */

app.use(globalErrorHandler);

app.use(notFound);

/**
 * =========================================================
 * SOCKET.IO
 * =========================================================
 */

export const io = new Server(server, {
  cors: {
    origin: allowedOrigins,

    methods: [
      "GET",
      "POST",
    ],

    credentials: true,
  },
});

/**
 * =========================================================
 * SOCKET.IO CONNECTION
 * =========================================================
 */

io.on("connection", (socket) => {
  console.log(
    "A client connected:",
    socket.id
  );

  /**
   * =======================================================
   * JOIN CHAT ROOM
   * =======================================================
   */

  socket.on("joinChatRoom", (userId) => {
    if (!userId) {
      return;
    }

    const roomName = `chat_${userId}`;

    socket.join(roomName);

    console.log(
      `Client ${socket.id} joined user room: ${userId}`
    );
  });

  /**
   * =======================================================
   * JOIN NOTIFICATION ROOM
   * =======================================================
   */

  socket.on("joinNotifications", (userId) => {
    if (!userId) {
      return;
    }

    const roomName = `user_${userId}`;

    socket.join(roomName);

    console.log(
      `Client ${socket.id} joined notifications: ${userId}`
    );
  });

  /**
   * =======================================================
   * JOIN ALERTS ROOM
   * =======================================================
   */

  socket.on("joinAlerts", () => {
    socket.join("alerts");

    console.log(
      `Client ${socket.id} joined alerts room`
    );
  });

  /**
   * =======================================================
   * DISCONNECT
   * =======================================================
   */

  socket.on("disconnect", () => {
    console.log(
      "Client disconnected:",
      socket.id
    );
  });
});

/**
 * =========================================================
 * SERVER START
 * =========================================================
 */

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  console.log(
    `Server is running on port ${PORT}`
  );

  try {
    /**
     * MongoDB connection
     */
    await mongoose.connect(
      process.env.MONGO_DB_URL
    );

    console.log(
      "MongoDB connected"
    );

    /**
     * Start notification scheduler
     */
    startNotificationScheduler();

  } catch (err) {
    console.error(
      "MongoDB connection error:",
      err
    );

    process.exit(1);
  }
});