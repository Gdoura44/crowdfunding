import http from "./client";
import { paths } from "./paths";

export const reportsApi = {
  create: (body) => http.post(paths.reports.create, body),
  mine: (params) => http.get(paths.reports.mine, { params }),
};

