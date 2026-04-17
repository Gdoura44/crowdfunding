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
    // Audit must not break the main flow in this PFE prototype.
  }
}

module.exports = { writeAudit };

