const express = require("express");
const authRoutes = require("./authRoutes");
const projectRoutes = require("./projectRoutes");
const notificationRoutes = require("./notificationRoutes");
const userRoutes = require("./userRoutes");
const adminRoutes = require("./adminRoutes");
const investmentRoutes = require("./investmentRoutes");
const webhookRoutes = require("./webhookRoutes");
const reportRoutes = require("./reportRoutes");
const payoutRoutes = require("./payoutRoutes");
const recommendationRoutes = require("./recommendationRoutes");
const chatbotRoutes = require("./chatbotRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/projects", projectRoutes);
router.use("/notifications", notificationRoutes);
router.use("/users", userRoutes);
router.use("/admin", adminRoutes);
router.use("/investments", investmentRoutes);
router.use("/webhooks", webhookRoutes);
router.use("/reports", reportRoutes);
router.use("/payouts", payoutRoutes);
router.use("/recommendations", recommendationRoutes);
router.use(chatbotRoutes);

module.exports = router;
