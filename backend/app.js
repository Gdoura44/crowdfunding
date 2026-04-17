const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const errorHandler = require("./middleware/errorHandler");
const apiRoutes = require("./routes/api");
const internalRoutes = require("./routes/internal");

const app = express();

const frontendOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: frontendOrigin,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

/** Architecture: rate limiting on `/api/*` (not on `/internal/*` used by n8n/cron). */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 400),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api", apiLimiter, apiRoutes);
app.use("/internal", internalRoutes);

app.use(errorHandler);

module.exports = app;
