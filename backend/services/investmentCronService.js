const Investment = require("../models/Investment");
const Transaction = require("../models/Transaction");

async function expireInitiatedInvestments({ olderThanMinutes = 30, limit = 200 } = {}) {
  const minutes = Number(olderThanMinutes);
  const cutoff = new Date(Date.now() - Math.max(minutes, 1) * 60 * 1000);
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000);

  const list = await Investment.find({ status: "INITIATED", createdAt: { $lt: cutoff } })
    .sort({ createdAt: 1 })
    .limit(safeLimit)
    .lean();

  let expired = 0;
  for (const inv of list) {
    // Alignement avec la conception: on n’expire que les investissements INITIATED qui n’ont jamais
    // déclenché de transaction. Si une transaction existe, c’est la réconciliation (statut provider)
    // qui détermine l’état final.
    const anyTx = await Transaction.findOne({ investmentId: inv._id })
      .select("_id")
      .lean();
    if (anyTx) continue;

    const res = await Investment.updateOne({ _id: inv._id, status: "INITIATED" }, { $set: { status: "FAILED" } });
    if (res.modifiedCount) {
      expired += 1;
    }
  }

  return { scanned: list.length, expired };
}

module.exports = { expireInitiatedInvestments };

