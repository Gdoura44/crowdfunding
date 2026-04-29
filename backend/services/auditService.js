const AuditLog = require("../models/AuditLog");

async function writeAudit({ actorId, actorRole, action, targetType, targetId, details }) {
  try {
    await AuditLog.create({
      actorId,
      actorRole,
      action,
      targetType,
      targetId,
      details: details || {},
    });
  } catch {
    // L’audit ne doit pas interrompre le flux métier principal: on capture l’erreur sans la propager.
  }
}

module.exports = { writeAudit };

