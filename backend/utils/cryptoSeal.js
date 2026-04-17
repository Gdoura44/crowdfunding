const crypto = require("crypto");

function deriveKey() {
  const raw =
    process.env.BANK_DETAILS_ENC_KEY ||
    process.env.INTERNAL_API_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    "dev-unsafe-key";
  return crypto.createHash("sha256").update(String(raw)).digest(); // 32 bytes
}

function seal(plaintext) {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function open(sealed) {
  const key = deriveKey();
  const buf = Buffer.from(String(sealed), "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(enc), decipher.final()]);
  return out.toString("utf8");
}

module.exports = { seal, open };

