const crypto = require("crypto");

function randomUrlToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

module.exports = { randomUrlToken, sha256Hex };
