const crypto = require("crypto");

function readMockSecret() {
  return process.env.MOCK_PAYMENT_WEBHOOK_SECRET || "dev-mock-secret";
}

function signPayload(rawBody) {
  const secret = readMockSecret();
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

function createPaymentLink({ amount, currency = "TND", referenceId }) {
  const providerPaymentId = `mock_${crypto.randomUUID()}`;
  const paymentUrl = `/mock-checkout?paymentId=${encodeURIComponent(
    providerPaymentId
  )}&ref=${encodeURIComponent(referenceId)}&amount=${encodeURIComponent(
    amount
  )}&currency=${encodeURIComponent(currency)}`;

  return {
    provider: "FLOUCI",
    providerPaymentId,
    paymentUrl,
  };
}

function cancelPayment() {
  return { ok: true };
}

function refundPayment() {
  return { ok: true };
}

module.exports = {
  signPayload,
  createPaymentLink,
  cancelPayment,
  refundPayment,
};

