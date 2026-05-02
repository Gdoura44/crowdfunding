const mongoose = require("mongoose");

let cachedSupportsTransactions; // true | false | undefined

function isTransactionUnsupportedError(err) {
  const msg = String(
    err?.message ||
      err?.errmsg ||
      err?.errorResponse?.errmsg ||
      err?.errorResponse?.message ||
      ""
  );
  return (
    msg.includes("Transaction numbers are only allowed") ||
    msg.includes("replica set") ||
    msg.includes("not supported") ||
    msg.includes("IllegalOperation")
  );
}

async function detectSupportsTransactions() {
  if (cachedSupportsTransactions != null) return cachedSupportsTransactions;
  try {
    if (!mongoose.connection?.db) {
      // Pas encore connecté: on ne peut pas détecter proprement, on tente les transactions.
      cachedSupportsTransactions = true;
      return cachedSupportsTransactions;
    }
    // MongoDB standalone ne renvoie généralement pas `setName`
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    cachedSupportsTransactions = Boolean(hello?.setName);
    return cachedSupportsTransactions;
  } catch {
    // En cas de doute, on tente (secours géré ailleurs).
    cachedSupportsTransactions = true;
    return cachedSupportsTransactions;
  }
}

/**
 * Pourquoi: en production (replica set), on veut des opérations multi-doc atomiques.
 * Mais en dev local, on utilise souvent MongoDB en standalone, qui ne supporte PAS les transactions.
 *
 * Ce helper garde le code “production-ready” tout en restant compatible localement:
 * - Exécute `work(session)` dans une transaction quand c’est supporté
 * - Sinon, retombe sur une exécution sans transaction (`session=null`)
 */
async function withOptionalTransaction(work) {
  // Par défaut, on reste compatible “dev/standalone” (sans transactions).
  // Si tu veux un mode plus “réel”, active `ENABLE_DB_TRANSACTIONS=true` ET utilise MongoDB en replica set.
  const enabled = String(process.env.ENABLE_DB_TRANSACTIONS || "")
    .trim()
    .toLowerCase() === "true";
  if (!enabled) {
    return await work(null);
  }
  const supports = await detectSupportsTransactions();
  if (!supports) {
    return await work(null);
  }
  const session = await mongoose.startSession();
  try {
    try {
      // `withTransaction` gère start/commit/abort et remonte une erreur claire si MongoDB ne supporte pas les transactions.
      return await session.withTransaction(async () => work(session));
    } catch (err) {
      if (isTransactionUnsupportedError(err)) {
        cachedSupportsTransactions = false;
        return await work(null);
      }
      throw err;
    }
  } finally {
    try {
      session.endSession();
    } catch {
      // ignorer
    }
  }
}

module.exports = { withOptionalTransaction };

