const express = require("express");
const requireInternalBearer = require("../../middleware/requireInternalBearer");
const workflowRoutes = require("./workflowRoutes");
const cronRoutes = require("./cronRoutes");

const router = express.Router();

router.use(requireInternalBearer);
router.use(workflowRoutes);
router.use(cronRoutes);

module.exports = router;
