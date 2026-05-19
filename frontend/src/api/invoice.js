import http from "./client";

export const invoiceApi = {
  list: (params = {}) =>
    http.get("/api/invoices", { params }),

  byId: (id) =>
    http.get(`/api/invoices/${id}`),
};
