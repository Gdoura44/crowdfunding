function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Format d’erreur backend:
 * - { message }
 * - { message, details: { fieldErrors: { field: [msg...] }, formErrors: [...] } }
 *
 * Pourquoi ce helper:
 * - éviter d’afficher du JSON brut à l’utilisateur
 * - centraliser le parsing (même format côté backend via Zod + errorHandler)
 */
export function extractApiError(err, fallback = "Action impossible.") {
  const data = err?.response?.data;
  const message = typeof data?.message === "string" ? data.message : "";

  const details = isPlainObject(data?.details) ? data.details : null;
  const fieldErrors = isPlainObject(details?.fieldErrors) ? details.fieldErrors : null;
  const formErrors = Array.isArray(details?.formErrors) ? details.formErrors : null;

  const fields = [];
  if (fieldErrors) {
    for (const [field, msgs] of Object.entries(fieldErrors)) {
      const list = Array.isArray(msgs) ? msgs.filter(Boolean) : [];
      for (const m of list) {
        fields.push({ field, message: String(m) });
      }
    }
  }

  const forms = (formErrors || []).filter(Boolean).map((m) => String(m));

  return {
    message: message || fallback,
    fieldMessages: fields,
    formMessages: forms,
  };
}

