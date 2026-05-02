const crypto = require("crypto");

function createTransfer({ amount, currency = "TND", referenceId }) {
  const providerTransferId = `mock_tr_${crypto.randomUUID()}`;
  const transferUrl =
    `/mock-payout-transfer?transferId=${encodeURIComponent(providerTransferId)}` +
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

