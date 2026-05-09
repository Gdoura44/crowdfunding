const crypto = require("crypto");

function createTransfer({ amount, currency = "TND", referenceId }) {
  const providerTransferId = `mock_tr_${crypto.randomUUID()}`;
  // payoutId est requis par la page mock (confirm API). referenceId = même id (payout Mongo).
  const payoutId = String(referenceId || "");
  const transferUrl =
    `/mock-payout-transfer?payoutId=${encodeURIComponent(payoutId)}` +
    `&transferId=${encodeURIComponent(providerTransferId)}` +
    `&ref=${encodeURIComponent(referenceId)}` +
    `&amount=${encodeURIComponent(amount)}` +
    `&currency=${encodeURIComponent(currency)}`;

  return {
    provider: "FLOUCI",
    providerTransferId,
    transferUrl,
  };
}

module.exports = { createTransfer };

