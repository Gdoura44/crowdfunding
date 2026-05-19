import http from "./client";

export const expertApi = {
  // --- Validation de l'analyse IA ---
  listProjects: (params = {}) =>
    http.get("/api/expert/projects", { params }),

  validateProject: (projectId, data) =>
    http.post(`/api/expert/projects/${projectId}/validate`, data),



  listConsultations: (params = {}) =>
    http.get("/api/expert/consultations", { params }),

  getConsultation: (id) =>
    http.get(`/api/expert/consultations/${id}`),

  sendMessage: (id, data) =>
    http.post(`/api/expert/consultations/${id}/messages`, data),

  closeConsultation: (id) =>
    http.post(`/api/expert/consultations/${id}/close`),
};
