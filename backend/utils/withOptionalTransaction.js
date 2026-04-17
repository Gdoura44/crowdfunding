const mongoose = require("mongoose");

function isTransactionUnsupportedError(err) {
  const msg = String(err?.message || "");
  return (
    msg.includes("Transaction numbers are only allowed") ||
    msg.includes("replica set") ||
    msg.includes("not supported") ||
    msg.includes("IllegalOperation")
  );
}

/**
 * WHY: In production (replica set), we want atomic multi-doc operations.
 * But local dev often uses standalone MongoDB which does NOT support transactions.
 *
 * This helper keeps the codebase "production-ready" while staying compatible locally:
 * - Runs `work(session)` inside a transaction when supported
 * - Falls back to a non-transactional execution (`session=null`) when unsupported
 */
async function withOptionalTransaction(work) {
  const session = await mongoose.startSession();
  try {
    try {
      session.startTransaction();
    } catch (e) {
      if (isTransactionUnsupportedError(e)) {
        return await work(null);
      }
      throw e;
    }

    const res = await work(session);
    await session.commitTransaction();
    return res;
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch {
      // ignore
    }
    if (isTransactionUnsupportedError(err)) {
      return await work(null);
    }
    throw err;
  } finally {
    try {
      session.endSession();
    } catch {
      // ignore
    }
  }
}

module.exports = { withOptionalTransaction };

