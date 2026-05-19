const mongoose = require("mongoose");
const Project = require("../models/Project");
const AuditLog = require("../models/AuditLog");
const Notification = require("../models/Notification");
const ExpertConsultation = require("../models/ExpertConsultation");
const HttpError = require("../utils/HttpError");
const { enqueueEmailForNotifications } = require("../integrations/emailQueue");
const { withOptionalTransaction } = require("../utils/withOptionalTransaction");
const {
  ProjectStatus,
  AIStatus,
  transitionProjectStatus,
} = require("../config/projectLifecycle");

/** Seuil : 30 % de l'objectif de financement. */
const EXPERT_CONSULTATION_THRESHOLD = 0.30;

// ---------------------------------------------------------------------------
// Validation de l'analyse IA (rôle expert — approve ou cancel seulement)
// ---------------------------------------------------------------------------

async function validateProjectAnalysis({
  expertId,
  projectId,
  decision,
  feedback = "",
}) {
  if (!mongoose.isValidObjectId(projectId)) {
    throw new HttpError(400, "Identifiant de projet invalide.");
  }

  const normalizedDecision = String(decision || "").toUpperCase();
  if (!["APPROVED", "REJECTED"].includes(normalizedDecision)) {
    throw new HttpError(400, "Décision invalide. Valeurs attendues : APPROVED (valider) ou REJECTED (annuler).");
  }

  const project = await Project.findById(projectId);
  if (!project) throw new HttpError(404, "Projet introuvable.");

  if (project.status !== ProjectStatus.UNDER_REVIEW) {
    throw new HttpError(
      409,
      "État invalide : le projet doit être en cours de revue (UNDER_REVIEW) pour que l'expert puisse statuer.",
      { expected: ProjectStatus.UNDER_REVIEW, actual: project.status },
      "INVALID_PROJECT_STATE"
    );
  }

  if (project.aiStatus !== AIStatus.COMPLETED || !project.aiAnalysis) {
    throw new HttpError(
      400,
      "Analyse IA non terminée. Attendez la fin de l'analyse avant de statuer."
    );
  }

  let createdNotifications = [];
  const updatedProject = await withOptionalTransaction(async (session) => {
    if (normalizedDecision === "APPROVED") {
      // L'expert valide → APPROVED (l'admin peut ensuite publier).
      transitionProjectStatus(project, ProjectStatus.APPROVED, {
        action: "EXPERT_VALIDATE_PROJECT",
      });
      await project.save(session ? { session } : undefined);

      await AuditLog.create(
        [
          {
            actorId: expertId,
            actorRole: "EXPERT",
            action: "EXPERT_VALIDATE_PROJECT",
            targetType: "Project",
            targetId: project._id,
            details: { decision: "APPROVED", feedback: feedback || "" },
          },
        ],
        session ? { session } : undefined
      );

      createdNotifications = await Notification.create(
        [
          {
            userId: project.creatorId,
            type: "PROJECT_APPROVED",
            title: `Analyse validée — ${project.title}`,
            message:
              `L'expert en analyse financière a validé votre projet "${project.title}". ` +
              `Un administrateur peut maintenant le publier pour l'ouvrir aux investissements.` +
              (feedback ? ` Commentaire de l'expert : ${feedback}` : ""),
            relatedEntityId: project._id,
            relatedEntityType: "PROJECT",
          },
        ],
        session ? { session } : undefined
      );
    } else {
      // L'expert rejette → REJECTED (créateur peut corriger et resoumettre).
      transitionProjectStatus(project, ProjectStatus.REJECTED, {
        action: "EXPERT_REJECT_PROJECT",
      });
      project.rejectionReason = String(feedback || "").trim();
      project.rejectedBy = expertId;
      project.rejectedAt = new Date();
      await project.save(session ? { session } : undefined);

      await AuditLog.create(
        [
          {
            actorId: expertId,
            actorRole: "EXPERT",
            action: "EXPERT_REJECT_PROJECT",
            targetType: "Project",
            targetId: project._id,
            details: { decision: "REJECTED", feedback: feedback || "" },
          },
        ],
        session ? { session } : undefined
      );

      createdNotifications = await Notification.create(
        [
          {
            userId: project.creatorId,
            type: "PROJECT_REJECTED",
            title: `Analyse non validée — ${project.title}`,
            message:
              `Votre projet "${project.title}" n'a pas été validé par l'expert en analyse financière. ` +
              `Vous pouvez le corriger et le resoumettre.` +
              (project.rejectionReason ? ` Motif : ${project.rejectionReason}` : ""),
            relatedEntityId: project._id,
            relatedEntityType: "PROJECT",
          },
        ],
        session ? { session } : undefined
      );
    }
    return project.toObject();
  });

  await enqueueEmailForNotifications(createdNotifications);
  return updatedProject;
}

// ---------------------------------------------------------------------------
// Liste des projets UNDER_REVIEW pour l'expert
// ---------------------------------------------------------------------------

async function listProjectsForExpert({ limit = 30 } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 30;
  return Project.find({ status: ProjectStatus.UNDER_REVIEW, isArchived: false })
    .sort({ updatedAt: -1 })
    .limit(safeLimit)
    .lean();
}

// ---------------------------------------------------------------------------
// Consultation expert-investisseur
// ---------------------------------------------------------------------------


/**
 * Ajoute un message à une consultation existante (investisseur ou expert).
 */
async function addMessage({ userId, userRole, consultationId, content }) {
  if (!mongoose.isValidObjectId(consultationId)) {
    throw new HttpError(400, "Identifiant de consultation invalide.");
  }
  const trimmed = String(content || "").trim();
  if (!trimmed) throw new HttpError(400, "Le message ne peut pas être vide.");
  if (trimmed.length > 2000) throw new HttpError(400, "Message trop long (max 2000 caractères).");

  const consultation = await ExpertConsultation.findById(consultationId);
  if (!consultation) throw new HttpError(404, "Consultation introuvable.");

  if (consultation.status === "CLOSED") {
    throw new HttpError(400, "Cette consultation est clôturée. Impossible d'envoyer un message.");
  }

  const senderRole = ["EXPERT", "ADMIN"].includes(userRole) ? "EXPERT" : "INVESTOR";

  // Vérification d'accès.
  if (senderRole === "INVESTOR" && String(consultation.investorId) !== String(userId)) {
    throw new HttpError(403, "Accès refusé à cette consultation.");
  }

  consultation.messages.push({
    senderRole,
    senderId: userId,
    content: trimmed,
  });

  if (consultation.status === "OPEN" && senderRole === "EXPERT") {
    consultation.status = "IN_PROGRESS";
    if (!consultation.expertId) consultation.expertId = userId;
  }

  await consultation.save();
  return consultation.toObject();
}

/**
 * Clôture une consultation (expert ou investisseur).
 */
async function closeConsultation({ userId, userRole, consultationId }) {
  if (!mongoose.isValidObjectId(consultationId)) {
    throw new HttpError(400, "Identifiant de consultation invalide.");
  }
  const consultation = await ExpertConsultation.findById(consultationId);
  if (!consultation) throw new HttpError(404, "Consultation introuvable.");
  if (consultation.status === "CLOSED") {
    throw new HttpError(400, "Cette consultation est déjà clôturée.");
  }

  const isExpert = ["EXPERT", "ADMIN"].includes(userRole);
  const isInvestor = String(consultation.investorId) === String(userId);
  if (!isExpert && !isInvestor) {
    throw new HttpError(403, "Accès refusé.");
  }

  consultation.status = "CLOSED";
  consultation.closedAt = new Date();
  consultation.closedBy = userId;
  await consultation.save();
  return consultation.toObject();
}

/**
 * Liste des consultations pour un investisseur.
 */
async function listInvestorConsultations({ investorId, status, limit = 20 } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 20;
  const query = { investorId };
  if (status) query.status = String(status);
  return ExpertConsultation.find(query)
    .populate({ path: "projectId", select: { title: 1, status: 1 }, options: { lean: true } })
    .sort({ updatedAt: -1 })
    .limit(safeLimit)
    .lean();
}

/**
 * Liste des consultations pour un expert (toutes ou filtrées).
 */
async function listExpertConsultations({ status, limit = 30 } = {}) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 30;
  const query = {};
  if (status) query.status = String(status);
  return ExpertConsultation.find(query)
    .populate({ path: "projectId", select: { title: 1, status: 1 }, options: { lean: true } })
    .populate({ path: "investorId", select: { email: 1, profile: 1 }, options: { lean: true } })
    .sort({ updatedAt: -1 })
    .limit(safeLimit)
    .lean();
}

/**
 * Récupère une consultation par son ID (accès vérifié).
 */
async function getConsultation({ userId, userRole, consultationId }) {
  if (!mongoose.isValidObjectId(consultationId)) {
    throw new HttpError(400, "Identifiant de consultation invalide.");
  }
  const consultation = await ExpertConsultation.findById(consultationId)
    .populate({ path: "projectId", select: { title: 1, status: 1, fundingGoal: 1, currentFunding: 1 }, options: { lean: true } })
    .populate({ path: "investorId", select: { email: 1, profile: 1 }, options: { lean: true } })
    .lean();
  if (!consultation) throw new HttpError(404, "Consultation introuvable.");

  const isExpert = ["EXPERT", "ADMIN"].includes(userRole);
  const isInvestor = String(consultation.investorId?._id || consultation.investorId) === String(userId);
  if (!isExpert && !isInvestor) {
    throw new HttpError(403, "Accès refusé à cette consultation.");
  }

  return consultation;
}

module.exports = {
  validateProjectAnalysis,
  listProjectsForExpert,
  addMessage,
  closeConsultation,
  listInvestorConsultations,
  listExpertConsultations,
  getConsultation,
  EXPERT_CONSULTATION_THRESHOLD,
};
